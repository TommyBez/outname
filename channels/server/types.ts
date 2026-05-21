import 'server-only'
import type { ModelMessage } from 'ai'
import type { Agent } from '@/shared/db/schema'

export type ChannelId = 'slack'

export interface IncomingChannelMessage {
  channel: ChannelId
  // Provider-native routing key used to resolve the agent binding.
  externalRoutingKey: string
  externalRoutingKind: 'channel' | 'dm'
  // Stable per-thread key, unique within `(channel, teamId)`.
  externalThreadKey: string
  externalUserDisplayName?: string
  externalUserId: string
  // Lazy loader for thread history already converted to AI SDK model-message
  // shape. Channel adapters that own the thread (Slack/Discord/Telegram via
  // Chat SDK) populate this from `thread.allMessages` + `toAiMessages`. It is
  // a thunk (not an eager array) so the dispatch layer can skip the
  // potentially paginated history fetch when no agent is bound to the thread.
  // Returning `undefined` falls back to the UIMessage conversion path.
  loadModelMessages?: () => Promise<ModelMessage[] | undefined>
  // Burst/queue messages supplied by Chat SDK when this message is the latest
  // queued turn for a locked thread.
  skipped?: IncomingChannelMessage[]
  // Workspace scope used to keep installs and bindings owner-safe in multi-user deployments.
  teamId: string
  text: string
  // Free-form metadata stored on `channel_thread_conversations`.
  threadMetadata?: Record<string, unknown>
}

export interface ChannelReplySink {
  // AI SDK fullStream passed through to Chat SDK.
  postAgentStream: (stream: AsyncIterable<unknown>) => Promise<void>
  // Notify the user that the turn failed. Kept best-effort.
  postError: (text: string) => Promise<void>
  // Plain follow-up message for budget/step-limit notices.
  postText: (text: string) => Promise<void>
  // Schedule work after the platform response/handler has settled.
  scheduleBackgroundTask: (task: () => Promise<void>) => void
  // Optional typing/loading indicator.
  startTyping?: (status?: string) => Promise<void>
}

export interface ChannelRoute {
  agent: Agent
  conversationId: string
  installationCreatedAt: Date
  installationUserId: string
}
