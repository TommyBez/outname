import {
  loadBuildRow,
  markBuildFailed,
  markBuildReady,
  markBuildRunning,
  readManifestSetupScript,
} from './steps/db-steps'
import { emitBuildEvent } from './steps/emit-build-event'
import { runSandboxBuild } from './steps/run-sandbox-build'

/**
 * Phase 4: tool-sandbox build workflow.
 *
 * Triggered from `attachToolAction` whenever a user attaches a tool
 * whose manifest has no current snapshot (or whose manifest hash has
 * drifted). One workflow run per build attempt; concurrent attaches
 * for the same `(manifest, hash)` are coalesced upstream onto a single
 * `tool_sandbox_builds` row, so they share this same run.
 *
 * Lifecycle:
 *   1. Mark the build row `running`.
 *   2. Read manifest id + hash off the row (so any future replay sees
 *      a deterministic input).
 *   3. Read `setup.sh` bytes for the manifest.
 *   4. Spawn a sandbox, run the script, snapshot. Emits coarse-grained
 *      `progress` events into the per-build stream the entire time.
 *   5. Atomically: upsert the snapshots row, mark this build `ready`,
 *      flip every `agent_tools` row that was waiting on this manifest
 *      to `connected`.
 *   6. Emit `ready` so any client tailing the stream can flip its UI
 *      and `router.refresh()`.
 *
 * On any thrown error the catch path marks the build `failed` (with a
 * stamped error message on every pending `agent_tools` row) and emits
 * `failed`. The error is re-thrown so the workflow run itself shows up
 * as failed in observability.
 */
export async function buildToolSandboxWorkflow(input: {
  buildId: string
}): Promise<void> {
  'use workflow'
  const { buildId } = input

  try {
    await markBuildRunning({ buildId })
    const { manifestId, manifestHash } = await loadBuildRow({ buildId })
    const { setup } = await readManifestSetupScript({ manifestId })

    const { snapshotId } = await runSandboxBuild({
      buildId,
      manifestId,
      setup,
    })

    await markBuildReady({ buildId, manifestId, manifestHash, snapshotId })
    await emitBuildEvent({
      buildId,
      event: { type: 'ready', snapshotId, ts: new Date().toISOString() },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    try {
      await markBuildFailed({ buildId, error: message })
    } catch (innerErr) {
      console.error(
        '[v0] buildToolSandboxWorkflow: markBuildFailed failed',
        innerErr
      )
    }
    await emitBuildEvent({
      buildId,
      event: { type: 'failed', error: message, ts: new Date().toISOString() },
    })
    throw err
  }
}
