import type {
  SlackBindingView as SlackBindingViewType,
  SlackInstallationView,
} from '@outname/shared/channels/slack/server/bindings-query'

export type { SlackBindingView } from '@outname/shared/channels/slack/server/bindings-query'
export type InstallationView = SlackInstallationView

export interface SlackBindingsPanelProps {
  agentId: string
  bindings: SlackBindingViewType[]
  installations: InstallationView[]
  isAvailable: boolean
  isConfigured: boolean
}
