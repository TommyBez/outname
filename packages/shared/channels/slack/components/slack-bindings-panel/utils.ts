import type { SlackBindingView } from './types'

export const KIND_LABEL: Record<SlackBindingView['kind'], string> = {
  channel: 'Channel',
  dm: 'Direct message',
}

export function workspaceLabel(input: {
  teamId: string
  workspaceName: string | null
}): string {
  if (input.workspaceName) {
    return `${input.workspaceName} (${input.teamId})`
  }
  return input.teamId
}
