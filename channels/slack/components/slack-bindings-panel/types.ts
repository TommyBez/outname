import type {
  SlackBindingView as SlackBindingViewType,
  SlackInstallationView,
} from '@/channels/slack/server/bindings-query'

export type { SlackBindingView } from '@/channels/slack/server/bindings-query'
export type InstallationView = SlackInstallationView

export interface SlackBindingsPanelProps {
  agentId: string
  bindings: SlackBindingViewType[]
  installations: InstallationView[]
  isConfigured: boolean
  isMultiWorkspace: boolean
}
