import 'server-only'
import type { Agent } from '@outname/db/schema'
import type { AppRevalidationPayload } from '@outname/shared/server/app-revalidation'

export type ChannelId = 'slack'

export interface IncomingChannelMessage {
  // Provider-normalized message creation time.
  createdAt: Date
  // Provider-native stable id for the single inbound message.
  externalMessageKey: string
  externalUserDisplayName?: string
  externalUserId: string
  // Provider-specific data persisted for audit/debugging, not routing.
  providerMetadata?: Record<string, unknown>
  text: string
}

export interface IncomingChannelTurn {
  channel: ChannelId
  current: IncomingChannelMessage
  // Smallest provider/account scope that separates two user-owned
  // installations which may see the same external thread/message ids.
  externalScopeId: string
  // Chat SDK normalized thread id.
  externalThreadId: string
  providerHistory?: () => Promise<IncomingChannelMessage[]>
  // Free-form metadata stored on `channel_thread_conversations`.
  providerMetadata?: Record<string, unknown>
  routing: {
    key: string
    kind: 'channel' | 'dm'
  }
  // Optional Chat SDK queue hint; dispatch must work without it.
  skipped?: IncomingChannelMessage[]
}

export interface ChannelReplySink {
  // AI SDK stream passed through to Chat SDK.
  postAgentStream: (stream: AsyncIterable<unknown>) => Promise<void>
  // Notify the user that the turn failed. Kept best-effort.
  postError: (text: string) => Promise<void>
  // Plain follow-up message for budget/step-limit notices.
  postText: (text: string) => Promise<void>
  revalidateAppTags?: (tags: AppRevalidationPayload['tags']) => void
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
