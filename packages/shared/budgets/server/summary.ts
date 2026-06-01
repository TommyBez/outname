import 'server-only'

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

const periodOrder: Record<BudgetPeriod, number> = {
  daily: 0,
  weekly: 1,
  monthly: 2,
}
