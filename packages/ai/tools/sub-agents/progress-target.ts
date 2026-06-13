import { getWritable } from '@outname/workflow/runtime'
import type { UIMessage, UIMessageChunk, UIMessageStreamWriter } from 'ai'

export type SubAgentProgressTarget =
  | { kind: 'workflow-parent-stream'; streamNamespace: string }
  | { kind: 'realtime-ui-writer'; writer: UIMessageStreamWriter<UIMessage> }
  | { kind: 'none' }

export const noSubAgentProgressTarget: SubAgentProgressTarget = {
  kind: 'none',
}

export function workflowParentStreamTarget(
  streamNamespace: string | null | undefined
): SubAgentProgressTarget {
  return streamNamespace
    ? { kind: 'workflow-parent-stream', streamNamespace }
    : noSubAgentProgressTarget
}

export function realtimeUiWriterTarget(
  writer: UIMessageStreamWriter<UIMessage> | null | undefined
): SubAgentProgressTarget {
  return writer
    ? { kind: 'realtime-ui-writer', writer }
    : noSubAgentProgressTarget
}

export function progressStreamNamespace(
  target: SubAgentProgressTarget | null | undefined
): string | null {
  return target?.kind === 'workflow-parent-stream'
    ? target.streamNamespace
    : null
}

export function progressUiWriter(
  target: SubAgentProgressTarget | null | undefined
): UIMessageStreamWriter<UIMessage> | null {
  return target?.kind === 'realtime-ui-writer' ? target.writer : null
}

/**
 * Must only be called from an existing workflow step or realtime execution
 * context. This helper is intentionally not marked with "use step": the
 * realtime UI writer variant is not serializable across a WDK step boundary,
 * while the workflow stream variant relies on getWritable() already running
 * inside a step context.
 */
export async function writePreliminarySubAgentOutput(input: {
  output: unknown
  target: SubAgentProgressTarget
  toolCallId: string
}): Promise<void> {
  if (input.target.kind === 'none') {
    return
  }

  try {
    const chunk = {
      type: 'tool-output-available',
      output: input.output,
      preliminary: true,
      toolCallId: input.toolCallId,
    } as const

    if (input.target.kind === 'realtime-ui-writer') {
      input.target.writer.write(chunk)
      return
    }

    const writable = getWritable<UIMessageChunk>({
      namespace: input.target.streamNamespace,
    })
    const writer = writable.getWriter()
    try {
      await writer.write(chunk)
    } finally {
      writer.releaseLock()
    }
  } catch {
    // Live tool updates are UX hints and must not fail the call itself.
  }
}
