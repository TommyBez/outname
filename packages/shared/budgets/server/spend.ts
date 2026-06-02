import 'server-only'

import { db } from '@outname/db'
import { agentTokenUsage } from '@outname/db/schema'
import { and, eq, gte, sql } from 'drizzle-orm'
import { periodStart } from './periods'
import { loadApplicableRules } from './rules'
import type { BudgetExceededInfo, BudgetPeriod, BudgetScope } from './types'

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
