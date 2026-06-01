import {
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'
import { user } from './auth'

export const userConnections = pgTable(
  'user_connections',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    connectorId: text('connector_id').notNull(),
    // Connector secrets stay encrypted at rest.
    credentials: text('credentials').notNull(),
    // Metadata is safe to read in the clear.
    metadata: jsonb('metadata').notNull().default({}),
    grantedScopes: jsonb('granted_scopes').notNull().default([]),
    status: text('status').notNull().default('active'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.connectorId] }),
    index('user_connections_user_idx').on(t.userId),
  ]
)

export type UserConnection = typeof userConnections.$inferSelect
export type ConnectionStatus = 'active' | 'invalid'
