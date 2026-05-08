import {
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'
import { user } from './auth'

/**
 * Generic per-(user, provider) API-key credential store. Replaces the
 * bespoke `gmail_connection` table from Phase 2.
 *
 * `credentials` is a base64-encoded AES-256-GCM envelope produced by
 * `lib/connection-crypto.ts`. Plaintext shape is opaque to the platform —
 * each connector defines its own.
 *
 * `metadata` is connector-defined free-form status context. API keys
 * do not get read by the UI, only decrypted inside the tool runtime.
 *
 * `status` lifecycle is owned by `connectors/runtime.ts`:
 *   active   ←   API key validates and saves
 *   invalid  ←   stored credential cannot be decrypted
 */
export const userConnections = pgTable(
  'user_connections',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    credentials: text('credentials').notNull(),
    metadata: jsonb('metadata').notNull().default({}),
    status: text('status').notNull().default('active'), // active | invalid
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
    primaryKey({ columns: [t.userId, t.provider] }),
    index('user_connections_user_idx').on(t.userId),
  ]
)

export type UserConnection = typeof userConnections.$inferSelect
export type ConnectionStatus = 'active' | 'invalid'
