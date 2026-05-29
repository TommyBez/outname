import { hasSlackIntegrationAccess } from '@outname/auth/server/auth-guard'
import {
  BudgetRules,
  type BudgetRuleView,
} from '@outname/shared/budgets/components/budget-rules'
import { listAgentBudgetRules } from '@outname/shared/budgets/server/rules'
import { sumSpendUsd } from '@outname/shared/budgets/server/spend'
import { SlackBindingsPanel } from '@outname/shared/channels/slack/components/slack-bindings-panel'
import { listSlackBindingsForAgent } from '@outname/shared/channels/slack/server/bindings-query'

export async function AgentSlackSection({
  agentId,
  userId,
}: {
  agentId: string
  userId: string
}) {
  const isAvailable = await hasSlackIntegrationAccess(userId)
  const { bindings, installations } = isAvailable
    ? await listSlackBindingsForAgent(agentId, userId)
    : { bindings: [], installations: [] }
  const isConfigured = Boolean(
    process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET
  )
  return (
    <SlackBindingsPanel
      agentId={agentId}
      bindings={bindings}
      installations={installations}
      isAvailable={isAvailable}
      isConfigured={isConfigured}
    />
  )
}

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

export function EditSkeleton() {
  return (
    <>
      <div className="mb-6 h-3 w-28 animate-pulse rounded-sm bg-muted" />
      <div className="mb-10 flex flex-col gap-2">
        <div className="h-3 w-20 animate-pulse rounded-sm bg-muted" />
        <div className="h-10 w-64 animate-pulse rounded-sm bg-muted" />
      </div>
      <div className="border-border border-t py-10">
        <div className="h-64 w-full animate-pulse rounded-sm bg-muted" />
      </div>
    </>
  )
}
