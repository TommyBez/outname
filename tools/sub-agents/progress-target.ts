export type SubAgentProgressTarget =
  | { kind: 'workflow-parent-stream'; streamNamespace: string }
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

export function progressStreamNamespace(
  target: SubAgentProgressTarget | null | undefined
): string | null {
  return target?.kind === 'workflow-parent-stream'
    ? target.streamNamespace
    : null
}
