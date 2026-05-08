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

/**
 * Budget rules. Two layers:
 *
 *   - **General** (`agent_id IS NULL`): caps total spend across every
 *     agent owned by the user.
 *   - **Per-agent** (`agent_id IS NOT NULL`): caps spend attributed to
 *     that single agent.
 *
 * Three time dimensions per layer: `daily` | `weekly` | `monthly`.
 * Limit is stored as USD with 6 fractional digits — enough to express
 * sub-cent amounts that show up when very small models are involved.
 *
 * Sub-agent invocations are attributed to the **root** agent the user
 * invoked, so a child's spend lands in the parent's bucket. Tools that
 * call out to external services (Resend, Gmail, etc.) are deliberately
 * NOT counted yet — only AI Gateway model spend.
 *
 * The unique index forces at most one rule per `(user, scope, period)`
 * — there's no use case for two competing daily caps on the same
 * agent.
 */
export const budgetRule = pgTable(
  'budget_rule',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** NULL means "general" budget covering every agent for this user. */
    agentId: text('agent_id').references(() => agent.id, {
      onDelete: 'cascade',
    }),
    period: text('period').$type<'daily' | 'weekly' | 'monthly'>().notNull(),
    /** USD with 6 decimal places. Stored as text by drizzle's `numeric`. */
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

/**
 * Per-stream token usage ledger. One row per `agent.stream()` call
 * (chat, heartbeat, reflection, sub-agent invocation). Cost is
 * computed at write time using the AI Gateway pricing snapshot — we
 * persist USD and the input/output rates so a later pricing change
 * doesn't retroactively rewrite history.
 *
 * `rootAgentId` is the agent the operator originally invoked. For
 * top-level events it equals `agentId`; for sub-agent invocations it
 * is `callStack[0]`. Budget queries always sum on `rootAgentId` so
 * sub-agent spend lands in the parent agent's bucket, per spec.
 *
 * The `(user_id, created_at)` and `(root_agent_id, created_at)`
 * indexes serve the two budget-rollup queries directly: SUM over a
 * rolling time window for general and per-agent rules respectively.
 */
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
    /**
     * Agent the operator invoked. Equals `agentId` for normal turns;
     * for sub-agent invocations, it's the root of the call stack.
     */
    rootAgentId: text('root_agent_id')
      .notNull()
      .references(() => agent.id, { onDelete: 'cascade' }),
    sourceType: text('source_type')
      .$type<'chat' | 'heartbeat' | 'reflection' | 'invocation'>()
      .notNull(),
    /** runId / conversationId / streamToken — informational only. */
    sourceId: text('source_id'),
    model: text('model').notNull(),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    /**
     * Reasoning tokens reported separately by some providers (already
     * priced as output by most gateways, kept here for forensics).
     */
    reasoningTokens: integer('reasoning_tokens').notNull().default(0),
    cachedInputTokens: integer('cached_input_tokens').notNull().default(0),
    /** Sum of input + output (mirrors AI SDK `LanguageModelUsage.totalTokens`). */
    totalTokens: bigint('total_tokens', { mode: 'number' })
      .notNull()
      .default(0),
    /** USD cost of this stream, accurate to 1e-9 dollars. */
    costUsd: numeric('cost_usd', { precision: 14, scale: 9 })
      .notNull()
      .default('0'),
    /** Snapshot of the per-token rates used to compute `costUsd`. */
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
