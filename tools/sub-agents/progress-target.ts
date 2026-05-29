import type { UIMessage, UIMessageStreamWriter } from 'ai'

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
