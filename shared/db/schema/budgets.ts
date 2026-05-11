import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { agent } from './agents'
import { user } from './auth'

export const budgetRule = pgTable(
  'budget_rule',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    // NULL means the user's shared budget across all agents.
    agentId: text('agent_id').references(() => agent.id, {
      onDelete: 'cascade',
    }),
    period: text('period').$type<'daily' | 'weekly' | 'monthly'>().notNull(),
    // Drizzle returns numeric columns as strings.
    limitUsd: numeric('limit_usd', { precision: 12, scale: 6 }).notNull(),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('budget_rule_user_idx').on(t.userId),
    index('budget_rule_agent_idx').on(t.agentId),
    uniqueIndex('budget_rule_user_general_period_unique_idx')
      .on(t.userId, t.period)
      .where(sql`agent_id IS NULL`),
    uniqueIndex('budget_rule_user_agent_period_unique_idx')
      .on(t.userId, t.agentId, t.period)
      .where(sql`agent_id IS NOT NULL`),
  ]
)

export const agentTokenUsage = pgTable(
  'agent_token_usage',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    agentId: text('agent_id')
      .notNull()
      .references(() => agent.id, { onDelete: 'cascade' }),
    // Budget rollups attribute sub-agent spend to the root agent.
    rootAgentId: text('root_agent_id')
      .notNull()
      .references(() => agent.id, { onDelete: 'cascade' }),
    sourceType: text('source_type')
      .$type<'chat' | 'heartbeat' | 'reflection' | 'invocation'>()
      .notNull(),
    sourceId: text('source_id'),
    model: text('model').notNull(),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    reasoningTokens: integer('reasoning_tokens').notNull().default(0),
    cachedInputTokens: integer('cached_input_tokens').notNull().default(0),
    totalTokens: bigint('total_tokens', { mode: 'number' })
      .notNull()
      .default(0),
    costUsd: numeric('cost_usd', { precision: 14, scale: 9 })
      .notNull()
      .default('0'),
    inputRateUsdPerToken: numeric('input_rate_usd_per_token', {
      precision: 14,
      scale: 12,
    }),
    outputRateUsdPerToken: numeric('output_rate_usd_per_token', {
      precision: 14,
      scale: 12,
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('agent_token_usage_user_created_idx').on(
      t.userId,
      t.createdAt.desc()
    ),
    index('agent_token_usage_root_agent_created_idx').on(
      t.rootAgentId,
      t.createdAt.desc()
    ),
    index('agent_token_usage_agent_created_idx').on(
      t.agentId,
      t.createdAt.desc()
    ),
  ]
)

export type BudgetRule = typeof budgetRule.$inferSelect
export type BudgetPeriod = 'daily' | 'weekly' | 'monthly'
export type AgentTokenUsage = typeof agentTokenUsage.$inferSelect
