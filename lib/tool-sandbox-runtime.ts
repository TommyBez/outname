import 'server-only'
import { Sandbox } from '@vercel/sandbox'
import { eq } from 'drizzle-orm'
import { getWorkflowMetadata } from 'workflow'
import { db } from '@/lib/db'
import { toolSandboxSnapshots } from '@/lib/db/schema'
import { getToolSandboxManifest } from '@/tools/sandboxes'

/**
 * Phase 4: per-run tool-sandbox runtime.
 *
 * The first call within a workflow run that needs manifest M lazily
 * spawns a Vercel Sandbox from M's snapshot, caches the handle keyed by
 * the current `workflowRunId`, and returns it. Subsequent calls inside
 * the same run reuse the cached handle — that's what keeps
 * agent-browser's persistent daemon alive across `open` → `snapshot` →
 * `click` etc.
 *
 * `endOfEvent` calls `stopAllToolSandboxesForRun()` which stops every
 * cached sandbox for the current run and clears the entry. The next
 * event in the same session will boot fresh.
 *
 * The cache lives in module memory. Because workflow steps may run on
 * different worker instances, the cache is best-effort: a cache miss
 * just spawns a new sandbox from the snapshot. agent-browser's daemon
 * surviving across calls is a happy-path optimisation, not a
 * correctness requirement.
 */

/** Subset of `Sandbox` the maintainer tools actually use. */
export interface ToolSandboxHandle {
  runCommand: Sandbox['runCommand']
}

interface CachedSandbox {
  manifestId: string
  sandbox: Sandbox
}

const cache = new Map<string, Map<string, CachedSandbox>>()

class ToolSandboxUnavailableError extends Error {
  constructor(
    public readonly manifestId: string,
    message: string
  ) {
    super(message)
    this.name = 'ToolSandboxUnavailableError'
  }
}

export { ToolSandboxUnavailableError }

function currentRunId(): string {
  // `getWorkflowMetadata()` is available inside `'use step'` bodies and
  // returns the runtime id of the workflow that's currently executing
  // — for tool calls, the long-lived agent session run.
  return getWorkflowMetadata().workflowRunId
}

async function readSnapshotId(manifestId: string): Promise<string | null> {
  const [row] = await db
    .select({ snapshotId: toolSandboxSnapshots.snapshotId })
    .from(toolSandboxSnapshots)
    .where(eq(toolSandboxSnapshots.manifestId, manifestId))
    .limit(1)
  return row?.snapshotId ?? null
}

/**
 * Get-or-create the sandbox for `manifestId` in the current workflow
 * run. Throws `ToolSandboxUnavailableError` if no snapshot exists yet
 * (the attach action is supposed to have built one before the tool
 * shows up to the model, so this is treated as a programming error).
 *
 * Must be called from inside a workflow step (`'use step'` body) so
 * `getWorkflowMetadata` works.
 */
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

  const manifest = getToolSandboxManifest(manifestId)
  const snapshotId = await readSnapshotId(manifestId)
  if (!snapshotId) {
    throw new ToolSandboxUnavailableError(
      manifestId,
      `Tool sandbox snapshot for manifest "${manifestId}" is not built yet.`
    )
  }

  const sandbox = await Sandbox.create({
    source: { type: 'snapshot', snapshotId },
    runtime: manifest.build.runtime,
    timeout: 600_000,
  } as Parameters<typeof Sandbox.create>[0])

  if (!perRun) {
    perRun = new Map()
    cache.set(runId, perRun)
  }
  perRun.set(manifestId, { manifestId, sandbox })

  return sandbox
}

/**
 * Stop every cached tool sandbox for the current workflow run. Called
 * by `endOfEvent` so each event boots fresh sandboxes (matches the
 * lifecycle of the system + exec sandboxes).
 *
 * Errors are logged and swallowed — a failed stop must never fail an
 * otherwise-successful event.
 */
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
