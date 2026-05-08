import type { AgentBudgetValues } from '@/agents/components/agent-budget-widget'
import {
  BudgetRules,
  type BudgetRuleView,
} from '@/budgets/components/budget-rules'
import { listAgentBudgetRules } from '@/budgets/server/rules'
import { sumSpendUsd } from '@/budgets/server/spend'
import { SlackBindingsPanel } from '@/channels/slack/components/slack-bindings-panel'
import { listSlackBindingsForAgent } from '@/channels/slack/server/bindings-query'

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

export async function AgentSlackSection({
  agentId,
  userId,
}: {
  agentId: string
  userId: string
}) {
  const { bindings, installations } = await listSlackBindingsForAgent(
    agentId,
    userId
  )
  const isMultiWorkspace = Boolean(
    process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET
  )
  const isSingleWorkspace = Boolean(
    process.env.SLACK_BOT_TOKEN && process.env.SLACK_SIGNING_SECRET
  )
  return (
    <SlackBindingsPanel
      agentId={agentId}
      bindings={bindings}
      installations={installations}
      isConfigured={isMultiWorkspace || isSingleWorkspace}
      isMultiWorkspace={isMultiWorkspace}
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
