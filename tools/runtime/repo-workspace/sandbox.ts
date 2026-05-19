import 'server-only'

import { type NetworkPolicy, Sandbox } from '@vercel/sandbox'
import { repoWorkspaceSandboxTags } from '@/shared/server/vercel-sandbox-config'
import { currentToolRuntimeRunId } from '@/tools/runtime/run-id'
import { createRepoWorkspaceBashTool } from './bash-tool'
import { RepoWorkspaceProviderError } from './errors'
import { REPO_WORKSPACE_ROOT } from './paths'
import { shellQuote } from './shell'
import type { RepoWorkspace } from './types'

interface CachedRepoWorkspace {
  workspacePromise: Promise<RepoWorkspace>
}

interface RepoWorkspaceCreateInput {
  attachmentToolId: string
  gitCredentials: {
    password: string
    username: string
  }
  networkPolicy: NetworkPolicy
  repoUrl: string
  runId: string
  vercelCredentials?: {
    projectId: string
    teamId: string
    token: string
  }
}

const repoWorkspaceCache = new Map<string, Map<string, CachedRepoWorkspace>>()

export async function getOrCreateRepoWorkspace(input: {
  attachmentToolId: string
  gitCredentials: {
    password: string
    username: string
  }
  networkPolicy: NetworkPolicy
  repoUrl: string
  vercelCredentials?: {
    projectId: string
    teamId: string
    token: string
  }
}): Promise<RepoWorkspace> {
  const runId = currentToolRuntimeRunId()
  const workspaceKey = [input.attachmentToolId, input.repoUrl].join('::')

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
    ...input,
    runId,
  }).catch((error) => {
    perRun?.delete(workspaceKey)
    throw error
  })

  perRun.set(workspaceKey, { workspacePromise })
  return await workspacePromise
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
        await workspace.sandbox.stop()
      } catch (error) {
        console.error('[v0] stopAllRepoWorkspacesForRun: stop failed', {
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
  let sandbox: Sandbox | null = null
  try {
    sandbox = await createWorkspaceSandbox(input)
    const bashTool = await createWorkspaceBashTool(sandbox)

    const workspace: RepoWorkspace = {
      bashTool,
      rootPath: REPO_WORKSPACE_ROOT,
      sandbox,
    }

    await refreshWorkspaceCheckout(workspace)

    return workspace
  } catch (error) {
    await stopWorkspaceSandbox(sandbox)

    if (error instanceof RepoWorkspaceProviderError) {
      throw error
    }

    throw new RepoWorkspaceProviderError(
      withFailureDetails('Failed to create the repo workspace.', error)
    )
  }
}

async function createWorkspaceSandbox(
  input: RepoWorkspaceCreateInput
): Promise<Sandbox> {
  try {
    return await Sandbox.create({
      source: {
        type: 'git',
        url: input.repoUrl,
        username: input.gitCredentials.username,
        password: input.gitCredentials.password,
        depth: 1,
      },
      persistent: false,
      ports: [3000],
      runtime: 'node22',
      timeout: 600_000,
      resources: { vcpus: 1 },
      // Source credentials authenticate the initial clone; the explicit
      // policy brokers GitHub credentials for later git and API calls.
      networkPolicy: input.networkPolicy,
      tags: repoWorkspaceSandboxTags({
        attachmentToolId: input.attachmentToolId,
        runId: input.runId,
      }),
      ...(input.vercelCredentials ?? {}),
    } as never)
  } catch (error) {
    throw new RepoWorkspaceProviderError(
      `Failed to create the repo workspace sandbox. ${describeSandboxApiError(error)}`
    )
  }
}

async function createWorkspaceBashTool(sandbox: Sandbox) {
  try {
    return await createRepoWorkspaceBashTool({
      rootPath: REPO_WORKSPACE_ROOT,
      sandbox,
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

async function refreshWorkspaceCheckout(
  workspace: RepoWorkspace
): Promise<void> {
  try {
    const result = await workspace.bashTool.bash.execute({
      command: [
        `git config --local --add safe.directory ${shellQuote(workspace.rootPath)}`,
        `git config user.name ${shellQuote(DEFAULT_COMMIT_AUTHOR_NAME)}`,
        `git config user.email ${shellQuote(DEFAULT_COMMIT_AUTHOR_EMAIL)}`,
        'git pull --ff-only',
      ].join(' && '),
    })
    assertWorkspaceCommandSucceeded(
      result,
      'Failed to refresh the repo workspace checkout.'
    )
  } catch (error) {
    if (error instanceof RepoWorkspaceProviderError) {
      throw error
    }
    throw new RepoWorkspaceProviderError(
      withFailureDetails(
        'Failed to refresh the repo workspace checkout.',
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

async function stopWorkspaceSandbox(sandbox: Sandbox | null): Promise<void> {
  if (!sandbox) {
    return
  }

  try {
    await sandbox.stop()
  } catch {
    // Best-effort cleanup on failed workspace startup.
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
