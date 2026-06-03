import {
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'
import { user } from './auth'

export const inferenceProviderValues = [
  'vercel-ai-gateway',
  'openrouter',
] as const

export type InferenceProvider = (typeof inferenceProviderValues)[number]

export const inferenceCredentialStatusValues = ['enabled', 'invalid'] as const

export type InferenceCredentialStatus =
  (typeof inferenceCredentialStatusValues)[number]

export const userInferenceCredentials = pgTable(
  'user_inference_credentials',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    inferenceProvider: text('inference_provider')
      .$type<InferenceProvider>()
      .notNull(),
    encryptedCredentials: text('encrypted_credentials').notNull(),
    status: text('status').$type<InferenceCredentialStatus>().notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    lastError: text('last_error'),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.inferenceProvider] })]
)

export type UserInferenceCredential =
  typeof userInferenceCredentials.$inferSelect
