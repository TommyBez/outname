import { Sandbox } from '@vercel/sandbox'
import { getWritable } from 'workflow'
import { toolBuildSandboxTags } from '@/shared/server/vercel-sandbox-config'
import { getToolSandboxManifest } from '@/tools/sandboxes'
import {
  buildToolSandboxNamespace,
  type ToolSandboxBuildEvent,
} from '../events'

// Run the manifest setup in a fresh sandbox, emit coarse progress events into
// the build stream, then snapshot the result. The whole build stays in one
// `'use step'` so failures fall back to the workflow's failed-build path.
export async function runSandboxBuild(input: {
  buildId: string
  manifestId: string
  setup: string
}): Promise<{ snapshotId: string }> {
  'use step'

  const manifest = getToolSandboxManifest(input.manifestId)
  const emit = async (message: string) => {
    try {
      const writable = getWritable<ToolSandboxBuildEvent>({
        namespace: buildToolSandboxNamespace(input.buildId),
      })
      const writer = writable.getWriter()
      try {
        await writer.write({
          type: 'progress',
          message,
          ts: new Date().toISOString(),
        })
      } finally {
        writer.releaseLock()
      }
    } catch {
      // Progress streaming is best-effort; missed UI updates must not fail the build.
    }
  }

  let sandbox: Sandbox | null = null
  try {
    await emit('Creating build sandbox...')
    sandbox = await Sandbox.create({
      runtime: manifest.build.runtime,
      timeout: manifest.build.timeout,
      persistent: false,
      resources: { vcpus: 2 },
      tags: toolBuildSandboxTags({
        buildId: input.buildId,
        manifestId: input.manifestId,
      }),
    })

    // Emit coarse phase markers instead of noisy line-by-line installer output.
    await emit('Installing system dependencies...')
    const result = await sandbox.runCommand({
      cmd: 'bash',
      args: ['-c', input.setup],
    })

    if (result.exitCode !== 0) {
      const stderr = (await result.stderr()).slice(0, 4000)
      const stdout = (await result.stdout()).slice(0, 1000)
      throw new Error(
        `setup script exited with code ${result.exitCode}\n--- stderr ---\n${stderr}\n--- stdout (tail) ---\n${stdout}`
      )
    }

    await emit('Capturing snapshot...')
    // `sandbox.snapshot()` already stops the sandbox, so the `finally` stop is
    // just a harmless cleanup fallback.
    const snapshot = await sandbox.snapshot()
    return { snapshotId: snapshot.snapshotId }
  } finally {
    if (sandbox) {
      try {
        await sandbox.stop()
      } catch {
        // Double-stop is harmless and also covers failures before a snapshot exists.
      }
    }
  }
}
