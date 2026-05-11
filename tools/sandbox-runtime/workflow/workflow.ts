import {
  loadBuildRow,
  markBuildFailed,
  markBuildReady,
  markBuildRunning,
  readManifestSetupScript,
} from './steps/db-steps'
import { emitBuildEvent } from './steps/emit-build-event'
import { runSandboxBuild } from './steps/run-sandbox-build'

// One workflow run builds one sandbox snapshot. Concurrent attaches for the
// same `(manifest, hash)` are coalesced upstream, and failures mark the build
// row failed before the error is re-thrown for observability.
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
