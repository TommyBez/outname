import 'server-only'
import { currentToolRuntimeRunId } from '@outname/ai/tools/runtime/run-id'
import { getToolSandboxManifest } from '@outname/ai/tools/sandboxes/registry'
import { db } from '@outname/db'
import { toolSandboxSnapshots } from '@outname/db/schema'
import {
  toolRuntimeSandboxTags,
  withVercelSandboxCredentials,
} from '@outname/shared/server/vercel-sandbox-config'
import {
  nonRetryableStepError,
  nonRetryableStepErrorFromUnknown,
} from '@outname/shared/server/workflow-step-errors'
import type { Sandbox } from '@vercel/sandbox'
import { eq } from 'drizzle-orm'

// Cache tool sandboxes per workflow run so repeated tool calls can reuse the
// same snapshot-backed process. The cache is best-effort and is cleared at the
// end of each event.
export interface ToolSandboxHandle {
  runCommand: Sandbox['runCommand']
}

const cache = new Map<string, Map<string, CachedSandbox>>()

interface CachedSandbox {
  manifestId: string
  sandbox: Sandbox
}

function currentRunId(): string {
  return currentToolRuntimeRunId()
}

async function readSnapshotId(manifestId: string): Promise<string | null> {
  const [row] = await db
    .select({ snapshotId: toolSandboxSnapshots.snapshotId })
    .from(toolSandboxSnapshots)
    .where(eq(toolSandboxSnapshots.manifestId, manifestId))
    .limit(1)
  return row?.snapshotId ?? null
}

// Must run inside a `'use step'` body so `getWorkflowMetadata()` works. Missing
// snapshots are treated as programmer error because attach should build them
// before the tool becomes callable.
export async function getOrStartToolSandbox(
  manifestId: string
): Promise<ToolSandboxHandle> {
  const runId = currentRunId()

  let perRun = cache.get(runId)
  if (perRun) {
    const cached = perRun.get(manifestId)
    if (cached) {
      return cached.sandbox
    }
  }

  try {
    getToolSandboxManifest(manifestId)
  } catch (error) {
    throw nonRetryableStepErrorFromUnknown(
      error,
      `tool sandbox manifest unavailable for "${manifestId}"`
    )
  }

  const snapshotId = await readSnapshotId(manifestId)
  if (!snapshotId) {
    throw nonRetryableStepError(
      `Tool sandbox snapshot for manifest "${manifestId}" is not built yet.`
    )
  }

  // Snapshot-backed sandboxes already encode their runtime in the snapshot.
  const { Sandbox } = await import('@vercel/sandbox')
  const sandbox = await Sandbox.create(
    withVercelSandboxCredentials({
      source: { type: 'snapshot' as const, snapshotId },
      persistent: false,
      tags: toolRuntimeSandboxTags({ manifestId, runId }),
      timeout: 600_000,
    })
  )

  if (!perRun) {
    perRun = new Map()
    cache.set(runId, perRun)
  }
  perRun.set(manifestId, { manifestId, sandbox })

  return sandbox
}

// Event workflow cleanup calls this so each event boots fresh tool sandboxes.
// Failed deletes are logged and swallowed so cleanup never poisons a successful turn.
export async function stopAllToolSandboxesForRun(): Promise<void> {
  let runId: string
  try {
    runId = currentRunId()
  } catch {
    // Outside a workflow context — nothing to clean up.
    return
  }

  const perRun = cache.get(runId)
  if (!perRun || perRun.size === 0) {
    cache.delete(runId)
    return
  }

  await Promise.all(
    Array.from(perRun.values()).map(async ({ manifestId, sandbox }) => {
      try {
        await sandbox.delete()
      } catch (err) {
        console.error(
          'stopAllToolSandboxesForRun: delete failed',
          manifestId,
          err
        )
      }
    })
  )
  cache.delete(runId)
}
