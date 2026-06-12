import 'server-only'

import { db } from '@outname/db'
import { agentTokenUsage, budgetRule } from '@outname/db/schema'
import { and, eq, gte, inArray, sql } from 'drizzle-orm'
import { periodStart } from './periods'
import { listAgentBudgetRules, listGeneralBudgetRulesForUser } from './rules'
import { sumSpendUsd } from './spend'
import type { BudgetPeriod, BudgetScope, BudgetSummaryEntry } from './types'

export async function loadBudgetSummary(input: {
  userId: string
  scope: BudgetScope
  now?: Date
}): Promise<BudgetSummaryEntry[]> {
  const rules =
    input.scope.type === 'general'
      ? await listGeneralBudgetRulesForUser(input.userId)
      : await listAgentBudgetRules({
          userId: input.userId,
          agentId: input.scope.agentId,
        })
  if (rules.length === 0) {
    return []
  }
  const entries = await Promise.all(
    rules.map(async (rule) => ({
      period: rule.period,
      limitUsd: Number(rule.limitUsd),
      enabled: rule.enabled,
      spentUsd: await sumSpendUsd({
        userId: input.userId,
        scope: input.scope,
        period: rule.period,
        now: input.now,
      }),
    }))
  )
  entries.sort((a, b) => periodOrder[a.period] - periodOrder[b.period])
  return entries
}

/**
 * Batched variant of {@link loadBudgetSummary} for agent scopes: one query for
 * all rules plus one aggregate spend query, instead of per-agent round trips.
 */
export async function loadAgentBudgetSummaries(input: {
  userId: string
  agentIds: readonly string[]
  now?: Date
}): Promise<Map<string, BudgetSummaryEntry[]>> {
  const summaries = new Map<string, BudgetSummaryEntry[]>()
  if (input.agentIds.length === 0) {
    return summaries
  }

  const rules = await db
    .select()
    .from(budgetRule)
    .where(
      and(
        eq(budgetRule.userId, input.userId),
        inArray(budgetRule.agentId, [...input.agentIds])
      )
    )
  if (rules.length === 0) {
    return summaries
  }

  const ruledAgentIds = [
    ...new Set(rules.map((rule) => rule.agentId).filter(isNonNull)),
  ]
  const spendByAgent = await sumSpendUsdByAgent({
    userId: input.userId,
    agentIds: ruledAgentIds,
    now: input.now,
  })

  for (const rule of rules) {
    if (!rule.agentId) {
      continue
    }
    const entries = summaries.get(rule.agentId) ?? []
    entries.push({
      period: rule.period,
      limitUsd: Number(rule.limitUsd),
      enabled: rule.enabled,
      spentUsd: spendByAgent.get(rule.agentId)?.[rule.period] ?? 0,
    })
    summaries.set(rule.agentId, entries)
  }
  for (const entries of summaries.values()) {
    entries.sort((a, b) => periodOrder[a.period] - periodOrder[b.period])
  }
  return summaries
}

async function sumSpendUsdByAgent(input: {
  userId: string
  agentIds: readonly string[]
  now?: Date
}): Promise<Map<string, Record<BudgetPeriod, number>>> {
  const dailyStart = periodStart('daily', input.now)
  const weeklyStart = periodStart('weekly', input.now)
  const monthlyStart = periodStart('monthly', input.now)
  const since = new Date(
    Math.min(weeklyStart.getTime(), monthlyStart.getTime())
  )
  const costExpr = sql`COALESCE(${agentTokenUsage.actualCostUsd}, ${agentTokenUsage.estimatedCostUsd}, 0)`

  const rows = await db
    .select({
      rootAgentId: agentTokenUsage.rootAgentId,
      daily: sql<string>`COALESCE(SUM(${costExpr}) FILTER (WHERE ${agentTokenUsage.createdAt} >= ${dailyStart}), 0)`,
      weekly: sql<string>`COALESCE(SUM(${costExpr}) FILTER (WHERE ${agentTokenUsage.createdAt} >= ${weeklyStart}), 0)`,
      monthly: sql<string>`COALESCE(SUM(${costExpr}) FILTER (WHERE ${agentTokenUsage.createdAt} >= ${monthlyStart}), 0)`,
    })
    .from(agentTokenUsage)
    .where(
      and(
        eq(agentTokenUsage.userId, input.userId),
        inArray(agentTokenUsage.rootAgentId, [...input.agentIds]),
        gte(agentTokenUsage.createdAt, since)
      )
    )
    .groupBy(agentTokenUsage.rootAgentId)

  const spendByAgent = new Map<string, Record<BudgetPeriod, number>>()
  for (const row of rows) {
    spendByAgent.set(row.rootAgentId, {
      daily: Number(row.daily),
      weekly: Number(row.weekly),
      monthly: Number(row.monthly),
    })
  }
  return spendByAgent
}

function isNonNull<T>(value: T | null): value is T {
  return value !== null
}

const periodOrder: Record<BudgetPeriod, number> = {
  daily: 0,
  weekly: 1,
  monthly: 2,
}
