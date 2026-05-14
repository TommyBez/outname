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
  // Thread history already converted to AI SDK model-message shape. Channel
  // adapters that own the thread (Slack/Discord/Telegram via Chat SDK) should
  // populate this from `thread.allMessages` + `toAiMessages` so the workflow
  // can skip `convertToModelMessages` and the model sees the full conversation.
  modelMessages?: ModelMessage[]
  // Workspace scope used to keep installs and bindings owner-safe in multi-user deployments.
  teamId: string
  text: string
  // Free-form metadata stored on `channel_thread_conversations`.
  threadMetadata?: Record<string, unknown>
}

export interface ChannelReplySink {
  // Notify the user that the turn failed. Kept best-effort.
  postError: (text: string) => Promise<void>
  // May receive an async iterable when the adapter supports streaming replies.
  postReply: (content: string | AsyncIterable<string>) => Promise<void>
  // Optional typing/loading indicator.
  startTyping?: (status?: string) => Promise<void>
}

export interface ChannelRoute {
  agent: Agent
  conversationId: string
}
