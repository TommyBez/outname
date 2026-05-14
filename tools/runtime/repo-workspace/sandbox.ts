import 'server-only'

import { Sandbox } from '@vercel/sandbox'
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { toolSandboxSnapshots } from '@/shared/db/schema'
import { repoWorkspaceSandboxTags } from '@/shared/server/vercel-sandbox-config'
import { createInjectedHeadersNetworkPolicy } from '@/tools/runtime/network-policy'
import { currentToolRuntimeRunId } from '@/tools/runtime/run-id'
import { getToolSandboxManifest } from '@/tools/sandboxes'
import { createRepoWorkspaceBashTool } from './bash-tool'
import {
  RepoWorkspaceProviderError,
  RepoWorkspaceUnavailableError,
} from './errors'
import { initializeRepoWorkspaceCheckout } from './git'
import { REPO_WORKSPACE_ROOT } from './paths'
import type { RepoWorkspace } from './types'

interface CachedRepoWorkspace {
  workspacePromise: Promise<RepoWorkspace>
}

const repoWorkspaceCache = new Map<string, Map<string, CachedRepoWorkspace>>()

export async function getOrCreateRepoWorkspace(input: {
  attachmentToolId: string
  authenticatedHosts: readonly string[]
  injectedHeaders: Record<string, string>
  manifestId: string
  repoUrl: string
}): Promise<RepoWorkspace> {
  const runId = currentToolRuntimeRunId()
  const workspaceKey = [
    input.manifestId,
    input.attachmentToolId,
    input.repoUrl,
  ].join('::')

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

async function createRepoWorkspace(input: {
  attachmentToolId: string
  authenticatedHosts: readonly string[]
  injectedHeaders: Record<string, string>
  manifestId: string
  repoUrl: string
  runId: string
}): Promise<RepoWorkspace> {
  getToolSandboxManifest(input.manifestId)
  const snapshotId = await readSnapshotId(input.manifestId)
  if (!snapshotId) {
    throw new RepoWorkspaceUnavailableError(
      `Tool sandbox snapshot for manifest "${input.manifestId}" is not built yet.`
    )
  }

  let sandbox: Sandbox | null = null
  try {
    sandbox = await Sandbox.create({
      source: { type: 'snapshot', snapshotId },
      persistent: false,
      timeout: 600_000,
      resources: { vcpus: 1 },
      networkPolicy: createInjectedHeadersNetworkPolicy({
        authenticatedHosts: input.authenticatedHosts,
        injectedHeaders: input.injectedHeaders,
      }),
      tags: repoWorkspaceSandboxTags({
        attachmentToolId: input.attachmentToolId,
        manifestId: input.manifestId,
        runId: input.runId,
      }),
    })

    const bashTool = await createRepoWorkspaceBashTool({
      rootPath: REPO_WORKSPACE_ROOT,
      sandbox,
    })
    const workspace: RepoWorkspace = {
      bashTool,
      rootPath: REPO_WORKSPACE_ROOT,
      sandbox,
    }

    await initializeRepoWorkspaceCheckout({
      repoUrl: input.repoUrl,
      workspace,
    })

    return workspace
  } catch (error) {
    if (sandbox) {
      try {
        await sandbox.stop()
      } catch {
        // Best-effort cleanup on failed workspace startup.
      }
    }

    if (
      error instanceof RepoWorkspaceProviderError ||
      error instanceof RepoWorkspaceUnavailableError
    ) {
      throw error
    }

    throw new RepoWorkspaceProviderError(
      error instanceof Error
        ? error.message
        : 'Failed to create the repo workspace.'
    )
  }
}

async function readSnapshotId(manifestId: string): Promise<string | null> {
  const [row] = await db
    .select({ snapshotId: toolSandboxSnapshots.snapshotId })
    .from(toolSandboxSnapshots)
    .where(eq(toolSandboxSnapshots.manifestId, manifestId))
    .limit(1)

  return row?.snapshotId ?? null
}
