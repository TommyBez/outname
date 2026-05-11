import 'server-only'
import type { Agent } from '@/shared/db/schema'

/**
 * Channel id space. New chat surfaces (Teams, Discord, WhatsApp, …) get
 * a string literal added here; the rest of the channel pipeline narrows
 * on this union so we can't dispatch into an unknown adapter.
 */
export type ChannelId = 'slack'

/**
 * Generic incoming message normalised across platforms. Platform
 * adapters translate the raw webhook payload into this shape before
 * handing it to `runChannelChatTurn`.
 *
 * Contract: adapters should emit provider-native ids here, not SDK
 * serialization artifacts. If an SDK prefixes or encodes thread/channel
 * ids internally, strip that in the adapter layer before filling
 * `externalRoutingKey` / `externalThreadKey`.
 *
 * `externalThreadKey` is the canonical thread identifier for this
 * channel (Slack uses `channel:thread_ts`, Teams uses
 * `tenant/team/channel/replyChain`, …). The shape is opaque to the
 * dispatcher — it is only used as a stable string key into
 * `channel_thread_conversations`.
 */
export interface IncomingChannelMessage {
  channel: ChannelId
  /**
   * Routing key used to find the agent that owns this thread. Slack
   * uses the channel id for `'channel'` events and the user id for
   * `'dm'` events.
   */
  externalRoutingKey: string
  externalRoutingKind: 'channel' | 'dm'
  /** Stable per-thread key, unique within `(channel, teamId)`. */
  externalThreadKey: string
  externalUserDisplayName?: string
  externalUserId: string
  /**
   * Workspace dimension (Slack team id, Teams tenant id, Discord guild
   * id). Required for owner scoping in multi-user deployments — the
   * dispatcher rejects messages whose workspace install belongs to a
   * different user than the matched agent. Use `''` only for channels
   * that have no workspace concept.
   */
  teamId: string
  text: string
  /** Free-form metadata stored on `channel_thread_conversations`. */
  threadMetadata?: Record<string, unknown>
}

/**
 * Sink the channel adapter hands to the dispatcher so the dispatcher
 * can post the agent's reply back without depending on the adapter
 * implementation.
 */
export interface ChannelReplySink {
  /** Notify the user that the turn failed. Kept best-effort. */
  postError: (text: string) => Promise<void>
  /**
   * Post the agent's response. May be called once per turn with either
   * the final text or an async iterable of text chunks (for adapters
   * that support streaming, e.g. Slack via the Chat SDK).
   */
  postReply: (content: string | AsyncIterable<string>) => Promise<void>
  /** Optional typing/loading indicator. */
  startTyping?: (status?: string) => Promise<void>
}

export interface ChannelRoute {
  agent: Agent
  conversationId: string
}
