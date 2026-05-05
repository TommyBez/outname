import 'server-only'

import type { LanguageModelUsage } from 'ai'
import { and, eq, gte, isNull, sql } from 'drizzle-orm'
import { getModelPricing } from '@/lib/ai-gateway-models'
import { db } from '@/lib/db'
import {
  agentTokenUsage,
  type BudgetPeriod,
  type BudgetRule,
  budgetRule,
} from '@/lib/db/schema'

export const BUDGET_PERIODS: readonly BudgetPeriod[] = [
  'daily',
  'weekly',
  'monthly',
] as const

export interface BudgetScopeAgent {
  agentId: string
  type: 'agent'
}

export interface BudgetScopeGeneral {
  type: 'general'
}

export type BudgetScope = BudgetScopeAgent | BudgetScopeGeneral

export interface BudgetExceededInfo {
  /** USD limit configured on the rule. */
  limitUsd: number
  period: BudgetPeriod
  scope: BudgetScope
  /** USD spent inside the current period window. */
  spentUsd: number
}

/**
 * Start-of-window for a budget period in UTC. We pick UTC over the
 * user's local timezone because:
 *
 *   - heartbeat/reflection/invocation events run inside workflow
 *     steps that have no `headers()` to read a session cookie from,
 *   - the ledger and the period rollup must agree on a single
 *     boundary, otherwise spend would shift between buckets when the
 *     timezone changed,
 *   - personal-assistant-agent is single-operator anyway, so calendar
 *     drift across timezones is not a concern.
 *
 * `daily` resets at 00:00 UTC, `weekly` resets at 00:00 UTC on
 * Monday, `monthly` resets at 00:00 UTC on the first of the month.
 */
export function periodStart(
  period: BudgetPeriod,
  now: Date = new Date()
): Date {
  const utc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  )
  switch (period) {
    case 'daily':
      return utc
    case 'weekly': {
      // ISO week: Monday = 1 ... Sunday = 7
      const day = utc.getUTCDay() || 7
      const monday = new Date(utc)
      monday.setUTCDate(utc.getUTCDate() - (day - 1))
      return monday
    }
    case 'monthly':
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    default: {
      const _exhaustive: never = period
      throw new Error(`Unsupported period: ${String(_exhaustive)}`)
    }
  }
}

/** Sum USD spend for a scope/period window. Sub-agents roll into the root. */
export async function sumSpendUsd(input: {
  userId: string
  scope: BudgetScope
  period: BudgetPeriod
  now?: Date
}): Promise<number> {
  const since = periodStart(input.period, input.now)
  const filters = [
    eq(agentTokenUsage.userId, input.userId),
    gte(agentTokenUsage.createdAt, since),
  ]
  if (input.scope.type === 'agent') {
    filters.push(eq(agentTokenUsage.rootAgentId, input.scope.agentId))
  }

  const [row] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${agentTokenUsage.costUsd}), 0)`,
    })
    .from(agentTokenUsage)
    .where(and(...filters))

  return row ? Number(row.total) : 0
}

/**
 * Resolve every budget rule that applies to a single agent run for
 * `userId`. For chat/heartbeat/reflection events `agentId` is the
 * top-level agent. For sub-agent invocations the caller MUST pass the
 * **root** agent id so per-agent rules attribute spend up the stack.
 */
export async function loadApplicableRules(input: {
  userId: string
  rootAgentId: string
}): Promise<BudgetRule[]> {
  return await db
    .select()
    .from(budgetRule)
    .where(
      and(
        eq(budgetRule.userId, input.userId),
        eq(budgetRule.enabled, true),
        sql`(${budgetRule.agentId} IS NULL OR ${budgetRule.agentId} = ${input.rootAgentId})`
      )
    )
}

/**
 * Pre-flight check: returns the first budget rule whose current spend
 * has already met or exceeded the configured limit. Callers should
 * refuse to start a new model stream when this returns a non-null
 * value.
 *
 * The check is intentionally "already over" rather than "would go
 * over" — we don't know the call's token cost until after it runs.
 * Once a rule is over, every subsequent call is blocked until the
 * window resets, which is the v1 contract this app spec asks for.
 */
export async function checkBudgetExceeded(input: {
  userId: string
  rootAgentId: string
  now?: Date
}): Promise<BudgetExceededInfo | null> {
  const rules = await loadApplicableRules({
    userId: input.userId,
    rootAgentId: input.rootAgentId,
  })
  if (rules.length === 0) {
    return null
  }

  for (const rule of rules) {
    const limitUsd = Number(rule.limitUsd)
    if (!Number.isFinite(limitUsd) || limitUsd <= 0) {
      continue
    }
    const scope: BudgetScope = rule.agentId
      ? { type: 'agent', agentId: rule.agentId }
      : { type: 'general' }
    const spent = await sumSpendUsd({
      userId: input.userId,
      scope,
      period: rule.period,
      now: input.now,
    })
    if (spent >= limitUsd) {
      return {
        scope,
        period: rule.period,
        spentUsd: spent,
        limitUsd,
      }
    }
  }
  return null
}

export class BudgetExceededError extends Error {
  readonly info: BudgetExceededInfo
  constructor(info: BudgetExceededInfo) {
    super(formatBudgetExceededMessage(info))
    this.name = 'BudgetExceededError'
    this.info = info
  }
}

export function formatBudgetExceededMessage(info: BudgetExceededInfo): string {
  const layer = info.scope.type === 'general' ? 'general' : 'agent'
  return `Budget exceeded: ${layer} ${info.period} limit of $${info.limitUsd.toFixed(2)} reached ($${info.spentUsd.toFixed(2)} spent).`
}

interface UsageInput {
  cachedInputTokens?: number
  inputTokens?: number
  outputTokens?: number
  reasoningTokens?: number
  totalTokens?: number
}

function readUsage(usage: LanguageModelUsage | UsageInput | undefined): {
  input: number
  output: number
  total: number
  reasoning: number
  cachedInput: number
} {
  const u = (usage ?? {}) as UsageInput
  const input = numberOrZero(u.inputTokens)
  const output = numberOrZero(u.outputTokens)
  const reasoning = numberOrZero(u.reasoningTokens)
  const cachedInput = numberOrZero(u.cachedInputTokens)
  const total = numberOrZero(u.totalTokens) || input + output
  return { input, output, total, reasoning, cachedInput }
}

function numberOrZero(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return 0
  }
  return Math.floor(value)
}

/**
 * Persist a token-usage row for one `agent.stream()` call. Cost is
 * computed against the live AI Gateway pricing snapshot. When pricing
 * is unavailable we still record the token counts (so the operator
 * can see activity) but mark cost as zero — the ledger never silently
 * inflates spend with a guess.
 */
export async function recordAgentTokenUsage(input: {
  userId: string
  agentId: string
  rootAgentId: string
  sourceType: 'chat' | 'heartbeat' | 'reflection' | 'invocation'
  sourceId?: string | null
  model: string
  usage: LanguageModelUsage | UsageInput | undefined
}): Promise<void> {
  const usage = readUsage(input.usage)
  if (
    usage.input === 0 &&
    usage.output === 0 &&
    usage.total === 0 &&
    usage.reasoning === 0 &&
    usage.cachedInput === 0
  ) {
    // Some streams (e.g. an immediate tool refusal) report no tokens.
    // Skip the row to keep the ledger meaningful.
    return
  }

  const pricing = await getModelPricing(input.model).catch(() => null)
  const inputRate = pricing?.inputUsdPerToken ?? 0
  const outputRate = pricing?.outputUsdPerToken ?? 0
  const costUsd = usage.input * inputRate + usage.output * outputRate

  await db.insert(agentTokenUsage).values({
    id: `tu_${Math.random().toString(36).slice(2)}${Date.now().toString(36).slice(-4)}`,
    userId: input.userId,
    agentId: input.agentId,
    rootAgentId: input.rootAgentId,
    sourceType: input.sourceType,
    sourceId: input.sourceId ?? null,
    model: input.model,
    inputTokens: usage.input,
    outputTokens: usage.output,
    reasoningTokens: usage.reasoning,
    cachedInputTokens: usage.cachedInput,
    totalTokens: usage.total,
    costUsd: costUsd.toFixed(9),
    inputRateUsdPerToken: pricing ? inputRate.toFixed(12) : null,
    outputRateUsdPerToken: pricing ? outputRate.toFixed(12) : null,
  })
}

/**
 * Pretty-print a USD amount for the budget UI. Renders sub-cent
 * spend with extra precision so a $0.0005 daily run doesn't display
 * as "$0.00".
 */
export function formatUsd(amount: number): string {
  if (!Number.isFinite(amount)) {
    return '$0.00'
  }
  if (amount >= 1) {
    return `$${amount.toFixed(2)}`
  }
  if (amount >= 0.01) {
    return `$${amount.toFixed(3)}`
  }
  if (amount === 0) {
    return '$0.00'
  }
  return `$${amount.toFixed(4)}`
}

export async function listBudgetRulesForUser(
  userId: string
): Promise<BudgetRule[]> {
  return await db.select().from(budgetRule).where(eq(budgetRule.userId, userId))
}

export async function listGeneralBudgetRulesForUser(
  userId: string
): Promise<BudgetRule[]> {
  return await db
    .select()
    .from(budgetRule)
    .where(and(eq(budgetRule.userId, userId), isNull(budgetRule.agentId)))
}

export async function listAgentBudgetRules(input: {
  userId: string
  agentId: string
}): Promise<BudgetRule[]> {
  return await db
    .select()
    .from(budgetRule)
    .where(
      and(
        eq(budgetRule.userId, input.userId),
        eq(budgetRule.agentId, input.agentId)
      )
    )
}
