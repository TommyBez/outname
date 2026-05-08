import { getWritable } from 'workflow'
import {
  buildToolSandboxNamespace,
  type ToolSandboxBuildEvent,
} from '../events'

export async function emitBuildEvent(input: {
  buildId: string
  event: ToolSandboxBuildEvent
}): Promise<void> {
  'use step'
  try {
    const writable = getWritable<ToolSandboxBuildEvent>({
      namespace: buildToolSandboxNamespace(input.buildId),
    })
    const writer = writable.getWriter()
    try {
      await writer.write(input.event)
    } finally {
      writer.releaseLock()
    }
  } catch {
    // Streaming is best-effort progress UI. Never fail the build for a missed event.
  }
}
