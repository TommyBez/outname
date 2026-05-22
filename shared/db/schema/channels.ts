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

export const channelInstallations = pgTable(
  'channel_installations',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    channel: text('channel').notNull(),
    externalId: text('external_id').notNull(),
    // Install secrets stay encrypted at rest.
    credentials: text('credentials'),
    // Metadata is intentionally cleartext for routing and UI state.
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

export const agentChannelBindings = pgTable(
  'agent_channel_bindings',
  {
    id: text('id').primaryKey(),
    // Denormalized so webhook routing can fan out per owner before loading agents.
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    agentId: text('agent_id')
      .notNull()
      .references(() => agent.id, { onDelete: 'cascade' }),
    channel: text('channel').notNull(),
    // Channel-native workspace/scope id: Slack team, future Discord guild, etc.
    teamId: text('team_id').notNull().default(''),
    externalKey: text('external_key').notNull(),
    kind: text('kind').$type<'channel' | 'dm'>().notNull(),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Bindings are unique per user, so different users can target the same external channel.
    uniqueIndex('agent_channel_bindings_lookup_idx').on(
      t.channel,
      t.teamId,
      t.externalKey,
      t.kind,
      t.userId
    ),
    index('agent_channel_bindings_agent_idx').on(t.agentId),
    index('agent_channel_bindings_user_idx').on(t.userId),
  ]
)

export const channelThreadConversations = pgTable(
  'channel_thread_conversations',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    channel: text('channel').notNull(),
    // Channel-native workspace/scope id: Slack team, future Discord guild, etc.
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
    // External threads are unique per agent so different users can map the same source thread separately.
    uniqueIndex('channel_thread_conversations_external_idx').on(
      t.channel,
      t.teamId,
      t.externalThreadKey,
      t.agentId
    ),
    index('channel_thread_conversations_conversation_idx').on(t.conversationId),
    index('channel_thread_conversations_agent_idx').on(t.agentId),
    index('channel_thread_conversations_user_idx').on(t.userId),
  ]
)

export type ChannelInstallation = typeof channelInstallations.$inferSelect
export type AgentChannelBinding = typeof agentChannelBindings.$inferSelect
export type ChannelThreadConversation =
  typeof channelThreadConversations.$inferSelect
export type ChannelInstallationStatus = 'active' | 'revoked'
export type AgentChannelBindingKind = 'channel' | 'dm'
