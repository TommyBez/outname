import 'server-only'

import { currentToolRuntimeRunId } from '@outname/ai/tools/runtime/run-id'
import {
  repoWorkspaceSandboxTags,
  withVercelSandboxCredentials,
} from '@outname/shared/server/vercel-sandbox-config'
import { type NetworkPolicy, Sandbox } from '@vercel/sandbox'
import { createRepoWorkspaceBashTool } from './bash-tool'
import { RepoWorkspaceProviderError } from './errors'
import { REPO_WORKSPACE_ROOT } from './paths'
import { hashRepoWorkspaceIdentityStep } from './sandbox-name-step'
import { shellQuote } from './shell'
import type {
  RepoWorkspace,
  RepoWorkspaceBashTool,
  RepoWorkspaceBashToolkit,
  RepoWorkspaceHandle,
  RepoWorkspaceReadTool,
  RepoWorkspaceWriteTool,
} from './types'

interface CachedRepoWorkspace {
  workspacePromise: Promise<RepoWorkspace>
}

interface RepoWorkspaceCreateInput {
  gitCredentials: {
    password: string
    username: string
  }
  handle: RepoWorkspaceHandle
  networkPolicy: NetworkPolicy
  repoUrl: string
}

const repoWorkspaceCache = new Map<string, Map<string, CachedRepoWorkspace>>()
export const REPO_WORKSPACE_SANDBOX_TIMEOUT_MS = 60 * 60 * 1000
const REPO_WORKSPACE_SANDBOX_NAME_PREFIX = 'repo'
const REPO_WORKSPACE_SANDBOX_NAME_RUN_ID_LENGTH = 32
const REPO_WORKSPACE_SANDBOX_NAME_MAX_LENGTH = 64
const SANDBOX_NAME_INVALID_CHARS_PATTERN = /[^a-z0-9-]+/g
const SANDBOX_NAME_REPEATED_DASHES_PATTERN = /-+/g
const SANDBOX_NAME_EDGE_DASHES_PATTERN = /^-+|-+$/g

export async function getOrCreateRepoWorkspace(input: {
  attachmentToolId: string
  gitCredentials: {
    password: string
    username: string
  }
  networkPolicy: NetworkPolicy
  repoUrl: string
}): Promise<RepoWorkspace> {
  const runId = currentToolRuntimeRunId()
  const workspaceKey = [input.attachmentToolId, input.repoUrl].join('::')
  const handle = await createRepoWorkspaceHandle({
    attachmentToolId: input.attachmentToolId,
    repoUrl: input.repoUrl,
    runId,
    workspaceKey,
  })

  let perRun = repoWorkspaceCache.get(runId)
  if (!perRun) {
    perRun = new Map()
    repoWorkspaceCache.set(runId, perRun)
  }

  const cached = perRun.get(workspaceKey)
  if (cached) {
    return await cached.workspacePromise
  }

  const workspacePromise = createRepoWorkspace({
    gitCredentials: input.gitCredentials,
    handle,
    networkPolicy: input.networkPolicy,
    repoUrl: input.repoUrl,
  }).catch((error) => {
    evictRepoWorkspace(runId, workspaceKey)
    throw error
  })

  perRun.set(workspaceKey, { workspacePromise })
  return await workspacePromise
}

async function createRepoWorkspaceHandle(input: {
  attachmentToolId: string
  repoUrl: string
  runId: string
  workspaceKey: string
}): Promise<RepoWorkspaceHandle> {
  return {
    ...input,
    rootPath: REPO_WORKSPACE_ROOT,
    sandboxName: await createRepoWorkspaceSandboxName(input),
  }
}

async function createRepoWorkspaceSandboxName(input: {
  attachmentToolId: string
  repoUrl: string
  runId: string
}): Promise<string> {
  const runIdPart = sanitizeSandboxNamePart(
    input.runId,
    REPO_WORKSPACE_SANDBOX_NAME_RUN_ID_LENGTH,
    'run'
  )
  const workspaceHash = await hashRepoWorkspaceIdentityStep(input)

  return [REPO_WORKSPACE_SANDBOX_NAME_PREFIX, runIdPart, workspaceHash]
    .join('-')
    .slice(0, REPO_WORKSPACE_SANDBOX_NAME_MAX_LENGTH)
    .replace(SANDBOX_NAME_EDGE_DASHES_PATTERN, '')
}

function sanitizeSandboxNamePart(
  value: string,
  maxLength: number,
  fallback: string
): string {
  const sanitized = value
    .toLowerCase()
    .replace(SANDBOX_NAME_INVALID_CHARS_PATTERN, '-')
    .replace(SANDBOX_NAME_REPEATED_DASHES_PATTERN, '-')
    .replace(SANDBOX_NAME_EDGE_DASHES_PATTERN, '')
    .slice(0, maxLength)
    .replace(SANDBOX_NAME_EDGE_DASHES_PATTERN, '')

  return sanitized || fallback
}

export async function stopAllRepoWorkspacesForRun(): Promise<void> {
  let runId: string
  try {
    runId = currentToolRuntimeRunId()
  } catch {
    return
  }

  const perRun = repoWorkspaceCache.get(runId)
  if (!perRun || perRun.size === 0) {
    repoWorkspaceCache.delete(runId)
    return
  }

  await Promise.all(
    Array.from(perRun.values()).map(async ({ workspacePromise }) => {
      try {
        const workspace = await workspacePromise
        await stopWorkspaceSandboxByHandle(workspace.handle)
      } catch (error) {
        console.error('[repo-workspace] stopAllRepoWorkspacesForRun failed', {
          error,
        })
      }
    })
  )

  repoWorkspaceCache.delete(runId)
}

async function createRepoWorkspace(
  input: RepoWorkspaceCreateInput
): Promise<RepoWorkspace> {
  try {
    await provisionWorkspaceSandbox(input)
    const bashTool = await createWorkspaceBashTool(input.handle)

    const workspace: RepoWorkspace = {
      bashTool,
      handle: input.handle,
    }

    await configureWorkspaceCheckout(workspace, input.repoUrl)

    return {
      ...workspace,
      bashTool: wrapBashToolWithStoppedSandboxEviction({
        bashTool,
        runId: input.handle.runId,
        workspaceKey: input.handle.workspaceKey,
      }),
    }
  } catch (error) {
    await stopWorkspaceSandboxByHandle(input.handle).catch(() => undefined)

    if (error instanceof RepoWorkspaceProviderError) {
      throw error
    }

    throw new RepoWorkspaceProviderError(
      withFailureDetails('Failed to create the repo workspace.', error)
    )
  }
}

async function provisionWorkspaceSandbox(
  input: RepoWorkspaceCreateInput
): Promise<void> {
  'use step'
  let sandbox: Sandbox
  try {
    sandbox = await Sandbox.getOrCreate(
      withVercelSandboxCredentials({
        name: input.handle.sandboxName,
        source: {
          type: 'git' as const,
          url: input.repoUrl,
          username: input.gitCredentials.username,
          password: input.gitCredentials.password,
          depth: 10,
        },
        persistent: false,
        ports: [3000],
        runtime: 'node22',
        timeout: REPO_WORKSPACE_SANDBOX_TIMEOUT_MS,
        resources: { vcpus: 1 },
        // Source credentials authenticate the initial clone. The remote URL is
        // sanitized before the bash surface is returned to the model.
        networkPolicy: input.networkPolicy,
        tags: repoWorkspaceSandboxTags({
          attachmentToolId: input.handle.attachmentToolId,
          runId: input.handle.runId,
        }),
      })
    )
  } catch (error) {
    throw new RepoWorkspaceProviderError(
      `Failed to get or create the repo workspace sandbox. ${describeSandboxApiError(error)}`
    )
  }

  await ensureWorkspaceRoot(sandbox, input.handle.rootPath)
}

async function ensureWorkspaceRoot(
  sandbox: Sandbox,
  rootPath: string
): Promise<void> {
  await sandbox.mkDir(rootPath).catch(async () => {
    const result = await sandbox.runCommand({
      cmd: 'mkdir',
      args: ['-p', rootPath],
    })
    if (result.exitCode !== 0) {
      const stderr = await result.stderr()
      throw new RepoWorkspaceProviderError(
        stderr.trim() || `Failed to create repo workspace root: ${rootPath}`
      )
    }
  })
}

async function createWorkspaceBashTool(handle: RepoWorkspaceHandle) {
  try {
    return await createRepoWorkspaceBashTool({
      handle,
    })
  } catch (error) {
    throw new RepoWorkspaceProviderError(
      withFailureDetails(
        'Failed to initialize the repo workspace bash toolkit.',
        error
      )
    )
  }
}

async function configureWorkspaceCheckout(
  workspace: RepoWorkspace,
  repoUrl: string
): Promise<void> {
  try {
    const result = await workspace.bashTool.bash.execute({
      command: [
        `git config --local --add safe.directory ${shellQuote(workspace.handle.rootPath)}`,
        `git remote set-url origin ${shellQuote(repoUrl)}`,
        `git config user.name ${shellQuote(DEFAULT_COMMIT_AUTHOR_NAME)}`,
        `git config user.email ${shellQuote(DEFAULT_COMMIT_AUTHOR_EMAIL)}`,
      ].join(' && '),
    })
    assertWorkspaceCommandSucceeded(
      result,
      'Failed to configure the repo workspace checkout.'
    )
  } catch (error) {
    if (error instanceof RepoWorkspaceProviderError) {
      throw error
    }
    throw new RepoWorkspaceProviderError(
      withFailureDetails(
        'Failed to configure the repo workspace checkout.',
        error
      )
    )
  }
}

function assertWorkspaceCommandSucceeded(
  result: { exitCode: number; stderr: string; stdout: string },
  fallbackMessage: string
): void {
  if (result.exitCode === 0) {
    return
  }

  const details = result.stderr.trim() || result.stdout.trim()
  throw new RepoWorkspaceProviderError(
    details ? `${fallbackMessage} ${details}` : fallbackMessage
  )
}

const DEFAULT_COMMIT_AUTHOR_EMAIL =
  'cursor-maintainer-tool@users.noreply.github.com'
const DEFAULT_COMMIT_AUTHOR_NAME = 'Cursor Maintainer Tool'
const STOPPED_SANDBOX_CODES = new Set(['sandbox_stopped', 'sandbox_stopping'])

function wrapBashToolWithStoppedSandboxEviction(input: {
  bashTool: RepoWorkspaceBashToolkit
  runId: string
  workspaceKey: string
}): RepoWorkspaceBashToolkit {
  const bash = wrapBashExecute(input.bashTool.bash, input)
  return {
    bash,
    tools: {
      bash,
      readFile: wrapReadFileExecute(input.bashTool.tools.readFile, input),
      writeFile: wrapWriteFileExecute(input.bashTool.tools.writeFile, input),
    },
  }
}

function wrapBashExecute(
  tool: RepoWorkspaceBashTool,
  cacheKey: { runId: string; workspaceKey: string }
): RepoWorkspaceBashTool {
  return {
    execute: async (input) =>
      await withStoppedSandboxEviction(cacheKey, () => tool.execute(input)),
  }
}

function wrapReadFileExecute(
  tool: RepoWorkspaceReadTool,
  cacheKey: { runId: string; workspaceKey: string }
): RepoWorkspaceReadTool {
  return {
    execute: async (input) =>
      await withStoppedSandboxEviction(cacheKey, () => tool.execute(input)),
  }
}

function wrapWriteFileExecute(
  tool: RepoWorkspaceWriteTool,
  cacheKey: { runId: string; workspaceKey: string }
): RepoWorkspaceWriteTool {
  return {
    execute: async (input) =>
      await withStoppedSandboxEviction(cacheKey, () => tool.execute(input)),
  }
}

async function withStoppedSandboxEviction<TResult>(
  cacheKey: { runId: string; workspaceKey: string },
  operation: () => Promise<TResult>
): Promise<TResult> {
  try {
    return await operation()
  } catch (error) {
    if (!isStoppedSandboxError(error)) {
      throw error
    }

    evictRepoWorkspace(cacheKey.runId, cacheKey.workspaceKey)
    throw new RepoWorkspaceProviderError(
      'Repo workspace sandbox is stopped or expired. Local workspace state was discarded; retry the tool call to start a fresh checkout.'
    )
  }
}

function evictRepoWorkspace(runId: string, workspaceKey: string): void {
  const perRun = repoWorkspaceCache.get(runId)
  if (!perRun) {
    return
  }
  perRun.delete(workspaceKey)
  if (perRun.size === 0) {
    repoWorkspaceCache.delete(runId)
  }
}

function isStoppedSandboxError(error: unknown): boolean {
  if (!(typeof error === 'object' && error !== null)) {
    return false
  }

  if (
    'code' in error &&
    typeof error.code === 'string' &&
    STOPPED_SANDBOX_CODES.has(error.code)
  ) {
    return true
  }

  const status = responseStatus(error)
  if (status === null) {
    return false
  }
  if (status === 404 || status === 410) {
    return true
  }

  return status === 422 && sandboxApiErrorCode(error) === 'sandbox_stopping'
}

function responseStatus(error: object): number | null {
  if (!('response' in error)) {
    return null
  }
  const response = error.response
  if (!(typeof response === 'object' && response !== null)) {
    return null
  }
  if (!('status' in response) || typeof response.status !== 'number') {
    return null
  }
  return response.status
}

function sandboxApiErrorCode(error: object): string | null {
  if (!('json' in error)) {
    return null
  }
  const json = error.json
  if (!(typeof json === 'object' && json !== null)) {
    return null
  }
  const body = json as { error?: { code?: unknown } }
  return typeof body.error?.code === 'string' ? body.error.code : null
}

async function stopWorkspaceSandboxByHandle(
  handle: RepoWorkspaceHandle
): Promise<void> {
  let sandbox: Sandbox
  try {
    sandbox = await Sandbox.get(
      withVercelSandboxCredentials({
        name: handle.sandboxName,
        resume: false,
      })
    )
  } catch (error) {
    if (isStoppedSandboxError(error)) {
      return
    }
    throw error
  }

  try {
    await sandbox.delete()
  } catch (error) {
    if (!isStoppedSandboxError(error)) {
      throw error
    }
  }
}

function describeSandboxApiError(error: unknown): string {
  if (!(typeof error === 'object' && error !== null)) {
    return String(error)
  }

  const message =
    'message' in error && typeof error.message === 'string'
      ? error.message
      : 'Unknown sandbox error.'
  const status =
    'response' in error &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'status' in error.response
      ? String(error.response.status)
      : null
  const json =
    'json' in error && error.json !== undefined
      ? ` ${JSON.stringify(error.json)}`
      : ''

  return status ? `${message} (HTTP ${status}).${json}` : `${message}.${json}`
}

function withFailureDetails(prefix: string, error: unknown): string {
  const details = describeUnknownError(error)
  return details ? `${prefix} ${details}` : prefix
}

function describeUnknownError(error: unknown): string {
  if (error === null || error === undefined) {
    return ''
  }
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  if (typeof error !== 'object' || error === null) {
    return String(error)
  }

  const message =
    'message' in error && typeof error.message === 'string'
      ? error.message
      : null
  const code =
    'code' in error && typeof error.code === 'string' ? error.code : null
  const status =
    'response' in error &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'status' in error.response
      ? String(error.response.status)
      : null
  const details = [message, code ? `code ${code}` : null, status].filter(
    (part): part is string => Boolean(part)
  )
  if (details.length > 0) {
    return details.join(' ')
  }

  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}
