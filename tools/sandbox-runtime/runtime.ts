import 'server-only'
import { Sandbox } from '@vercel/sandbox'
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { toolSandboxSnapshots } from '@/shared/db/schema'
import { toolRuntimeSandboxTags } from '@/shared/server/vercel-sandbox-config'
import { currentToolRuntimeRunId } from '@/tools/runtime/run-id'
import { getToolSandboxManifest } from '@/tools/sandboxes/registry'

// Cache tool sandboxes per workflow run so repeated tool calls can reuse the
// same snapshot-backed process. The cache is best-effort and is cleared at the
// end of each event.
export interface ToolSandboxHandle {
  runCommand: Sandbox['runCommand']
}

interface CachedSandbox {
  manifestId: string
  sandbox: Sandbox
}

const cache = new Map<string, Map<string, CachedSandbox>>()

class ToolSandboxUnavailableError extends Error {
  readonly manifestId: string
  constructor(manifestId: string, message: string) {
    super(message)
    this.manifestId = manifestId
    this.name = 'ToolSandboxUnavailableError'
  }
}

export { ToolSandboxUnavailableError }

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

  // Refuse to spawn snapshots for manifests that were removed from the registry.
  getToolSandboxManifest(manifestId)
  const snapshotId = await readSnapshotId(manifestId)
  if (!snapshotId) {
    throw new ToolSandboxUnavailableError(
      manifestId,
      `Tool sandbox snapshot for manifest "${manifestId}" is not built yet.`
    )
  }

  // Snapshot-backed sandboxes already encode their runtime in the snapshot.
  const sandbox = await Sandbox.create({
    source: { type: 'snapshot', snapshotId },
    persistent: false,
    tags: toolRuntimeSandboxTags({ manifestId, runId }),
    timeout: 600_000,
  })

  if (!perRun) {
    perRun = new Map()
    cache.set(runId, perRun)
  }
  perRun.set(manifestId, { manifestId, sandbox })

  return sandbox
}

// Event workflow cleanup calls this so each event boots fresh tool sandboxes. Failed
// stops are logged and swallowed so cleanup never poisons a successful turn.
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
        await sandbox.stop()
      } catch (err) {
        console.error(
          '[v0] stopAllToolSandboxesForRun: stop failed',
          manifestId,
          err
        )
      }
    })
  )
  cache.delete(runId)
}
