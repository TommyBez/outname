import {
  BudgetRules,
  type BudgetRuleView,
} from '@outname/shared/budgets/components/budget-rules'
import { listAgentBudgetRules } from '@outname/shared/budgets/server/rules'
import { sumSpendUsd } from '@outname/shared/budgets/server/spend'

export async function AgentBudgetSection({
  agentId,
  agentName,
  userId,
}: {
  agentId: string
  agentName: string
  userId: string
}) {
  const rules = await listAgentBudgetRules({ userId, agentId })
  const views: BudgetRuleView[] = await Promise.all(
    rules.map(async (r) => ({
      id: r.id,
      agentId,
      agentName,
      period: r.period,
      limitUsd: Number(r.limitUsd),
      enabled: r.enabled,
      spentUsd: await sumSpendUsd({
        userId,
        scope: { type: 'agent', agentId },
        period: r.period,
      }),
    }))
  )
  return (
    <BudgetRules rules={views} scope={{ type: 'agent', agentId, agentName }} />
  )
}
