import { index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { agent } from './agents'

// Chat conversations: an agent can own many independent threads. Listing
// in the sidebar is always "newest first for this agent", so we index on
// (agent_id, updated_at DESC) to serve that exact query without a sort.
export const chatConversation = pgTable(
  'chat_conversation',
  {
    id: text('id').primaryKey(),
    agentId: text('agent_id')
      .notNull()
      .references(() => agent.id, { onDelete: 'cascade' }),
    title: text('title'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('chat_conversation_agent_updated_idx').on(
      t.agentId,
      t.updatedAt.desc()
    ),
  ]
)

// Chat messages: store full UIMessage parts array as JSONB so we keep tool
// calls, reasoning blocks, and custom data parts intact for replay.
export const chatMessage = pgTable(
  'chat_message',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => chatConversation.id, { onDelete: 'cascade' }),
    role: text('role').notNull(), // user | assistant | system
    parts: jsonb('parts').notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('chat_message_conversation_idx').on(t.conversationId, t.createdAt),
  ]
)

export type ChatConversation = typeof chatConversation.$inferSelect
export type ChatMessage = typeof chatMessage.$inferSelect
export type ChatRole = 'user' | 'assistant' | 'system'
