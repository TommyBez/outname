import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { agent } from './agents'
import { user } from './auth'
import { chatConversation } from './chat'

/**
 * External chat-channel installations (Slack workspace, Teams tenant,
 * Discord guild, …). One row per (user, channel, externalId).
 *
 * Credentials are encrypted with the same envelope used for
 * `user_connections`. `metadata` carries channel-specific state that is
 * safe to read in the clear (bot user id, team name, app id).
 *
 * Status lifecycle:
 *   active   ←   installation works
 *   revoked  ←   operator removed the install or token was rotated out
 */
export const channelInstallations = pgTable(
  'channel_installations',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    channel: text('channel').notNull(),
    externalId: text('external_id').notNull(),
    credentials: text('credentials'),
    metadata: jsonb('metadata').notNull().default({}),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('channel_installations_unique_idx').on(
      t.userId,
      t.channel,
      t.externalId
    ),
    index('channel_installations_channel_idx').on(t.channel),
  ]
)

/**
 * Routes incoming external messages to a specific agent. Resolved at
 * webhook time by `(channel, teamId, externalKey, kind)`.
 *
 * - `teamId`            — workspace dimension (Slack team id, Teams
 *                         tenant id, Discord guild id). Required even
 *                         for channels that don't have a workspace
 *                         concept; use `''` as a sentinel in that case.
 * - `kind = 'channel'`  — a Slack channel id, Teams channel id, …
 * - `kind = 'dm'`       — a Slack user id (when DMing the bot)
 * - `kind = 'default'`  — fallback for any unbound thread within this
 *                         workspace; externalKey is ''
 */
export const agentChannelBindings = pgTable(
  'agent_channel_bindings',
  {
    id: text('id').primaryKey(),
    agentId: text('agent_id')
      .notNull()
      .references(() => agent.id, { onDelete: 'cascade' }),
    channel: text('channel').notNull(),
    teamId: text('team_id').notNull().default(''),
    externalKey: text('external_key').notNull(),
    kind: text('kind').$type<'channel' | 'dm' | 'default'>().notNull(),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('agent_channel_bindings_lookup_idx').on(
      t.channel,
      t.teamId,
      t.externalKey,
      t.kind
    ),
    index('agent_channel_bindings_agent_idx').on(t.agentId),
  ]
)

/**
 * Maps an external thread (Slack channel+thread_ts, Teams reply chain,
 * Discord thread) to a `chat_conversation` row owned by an agent.
 *
 * One external thread within a single workspace maps to exactly one
 * conversation, so the agent's existing chat history, memory, and tool
 * runtime are reused regardless of which surface (web UI, Slack, …)
 * the message arrived from.
 */
export const channelThreadConversations = pgTable(
  'channel_thread_conversations',
  {
    id: text('id').primaryKey(),
    channel: text('channel').notNull(),
    teamId: text('team_id').notNull().default(''),
    externalThreadKey: text('external_thread_key').notNull(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => chatConversation.id, { onDelete: 'cascade' }),
    agentId: text('agent_id')
      .notNull()
      .references(() => agent.id, { onDelete: 'cascade' }),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('channel_thread_conversations_external_idx').on(
      t.channel,
      t.teamId,
      t.externalThreadKey
    ),
    index('channel_thread_conversations_conversation_idx').on(t.conversationId),
    index('channel_thread_conversations_agent_idx').on(t.agentId),
  ]
)

export type ChannelInstallation = typeof channelInstallations.$inferSelect
export type AgentChannelBinding = typeof agentChannelBindings.$inferSelect
export type ChannelThreadConversation =
  typeof channelThreadConversations.$inferSelect
export type ChannelInstallationStatus = 'active' | 'revoked'
export type AgentChannelBindingKind = 'channel' | 'dm' | 'default'
