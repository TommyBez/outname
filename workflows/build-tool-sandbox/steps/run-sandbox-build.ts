import { Sandbox } from '@vercel/sandbox'
import { getWritable } from 'workflow'
import { getToolSandboxManifest } from '@/tools/sandboxes'
import {
  buildToolSandboxNamespace,
  type ToolSandboxBuildEvent,
} from '../events'

/**
 * Phase 4: provision a fresh Vercel Sandbox, run the manifest's
 * setup script, snapshot the result, and return the snapshot id.
 *
 * Emits coarse-grained `progress` events into the build's per-run
 * stream namespace so the UI can render a live progress strip without
 * us persisting messages to the DB. The stream is replayable from
 * `startIndex: 0` for the lifetime of the workflow run, which covers
 * any client mount / refresh / reconnect during the build.
 *
 * Marked `'use step'` so it's a single durable boundary — failure
 * surfaces back to the workflow's catch which marks the build failed.
 */
export async function runSandboxBuild(input: {
  buildId: string
  manifestId: string
  setup: string
}): Promise<{ snapshotId: string }> {
  'use step'

  const manifest = getToolSandboxManifest(input.manifestId)
  const writable = getWritable<ToolSandboxBuildEvent>({
    namespace: buildToolSandboxNamespace(input.buildId),
  })
  const writer = writable.getWriter()
  const emit = async (message: string) => {
    try {
      await writer.write({
        type: 'progress',
        message,
        ts: new Date().toISOString(),
      })
    } catch {
      // Stream emit is best-effort; never fail the build for a missed
      // progress message.
    }
  }

  let sandbox: Sandbox | null = null
  try {
    await emit('Creating build sandbox...')
    sandbox = await Sandbox.create({
      runtime: manifest.build.runtime,
      timeout: manifest.build.timeout,
      resources: { vcpus: 2 },
    })

    // Heuristic phase markers so the UI can show progress even though
    // we run the setup as one bash invocation. We don't tail per-line
    // installer output — that's noisy and rarely useful.
    await emit('Installing system dependencies...')
    const result = await sandbox.runCommand({
      cmd: 'bash',
      args: ['-c', input.setup],
    })

    if (result.exitCode !== 0) {
      const stderr = (await result.stderr()).slice(0, 4000)
      const stdout = (await result.stdout()).slice(0, 1000)
      throw new Error(
        `setup.sh exited with code ${result.exitCode}\n--- stderr ---\n${stderr}\n--- stdout (tail) ---\n${stdout}`
      )
    }

    await emit('Capturing snapshot...')
    // `sandbox.snapshot()` stops this sandbox internally as part of
    // creating the snapshot, so the `sandbox.stop()` call in `finally`
    // becomes a no-op (it'll throw, which we already swallow).
    const snapshot = await sandbox.snapshot()
    return { snapshotId: snapshot.snapshotId }
  } finally {
    if (sandbox) {
      try {
        await sandbox.stop()
      } catch {
        // `sandbox.snapshot()` already stops the sandbox; this catch
        // also covers the early-exit failure path where no snapshot
        // was taken. Either way, double-stop is harmless.
      }
    }
    try {
      await writer.close()
    } catch {
      // Ignore — closing twice or after a failed write is harmless.
    }
  }
}
