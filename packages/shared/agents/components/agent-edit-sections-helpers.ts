import type { AgentBudgetValues } from '@outname/shared/agents/components/agent-budget-values'
import type { listAgentBudgetRules } from '@outname/shared/budgets/server/rules'

export function summarizeBudgetRules(
  rules: Awaited<ReturnType<typeof listAgentBudgetRules>>
): AgentBudgetValues {
  const result: AgentBudgetValues = {
    daily: null,
    weekly: null,
    monthly: null,
  }
  for (const rule of rules) {
    if (!rule.enabled) {
      continue
    }
    const limit = Number(rule.limitUsd)
    if (!Number.isFinite(limit) || limit <= 0) {
      continue
    }
    if (rule.period === 'daily') {
      result.daily = limit
    } else if (rule.period === 'weekly') {
      result.weekly = limit
    } else if (rule.period === 'monthly') {
      result.monthly = limit
    }
  }
  return result
}
