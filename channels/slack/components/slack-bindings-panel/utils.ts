import type { SlackBindingView } from './types'

export const KIND_LABEL: Record<SlackBindingView['kind'], string> = {
  channel: 'Channel',
  dm: 'Direct message',
  default: 'Workspace fallback',
}

export function describeBindingTarget(binding: SlackBindingView): string {
  if (binding.kind === 'default') {
    return 'Any unbound thread'
  }
  return binding.externalKey
}

export function workspaceLabel(input: {
  teamId: string
  workspaceName: string | null
}): string {
  if (input.teamId === '') {
    return 'Single-workspace install'
  }
  if (input.workspaceName) {
    return `${input.workspaceName} (${input.teamId})`
  }
  return input.teamId
}
