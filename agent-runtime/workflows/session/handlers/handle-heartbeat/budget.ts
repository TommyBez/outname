import { emitActivity } from '@/agent-runtime/server/run-events'
import { formatBudgetExceededMessage } from '@/budgets/server/errors'
import { preflightBudget } from '../../steps/budget'
import { finalizeRun } from '../../steps/finalize-run'
import { activityMessage, type HeartbeatMode } from './messages'

export const BUDGET_EXCEEDED = Symbol('budget-exceeded')

export async function checkBudgetOrFinalize(input: {
  agentId: string
  mode: HeartbeatMode
  runId: string
}): Promise<string | null | typeof BUDGET_EXCEEDED> {
  const { agentId, mode, runId } = input
  const { loadAgentStep } = await import('../../steps/db/load-agent')
  const agentRow = await loadAgentStep({ agentId })
  const userId = agentRow?.userId ?? null
  if (!userId) {
    return null
  }
  const exceeded = await preflightBudget({
    userId,
    rootAgentId: agentId,
  })
  if (!exceeded) {
    return userId
  }
  await emitActivity(
    runId,
    activityMessage(mode, 'Budget exceeded, skipping run'),
    {
      period: exceeded.period,
      scope: exceeded.scope.type,
    }
  )
  await finalizeRun(runId, 'completed', formatBudgetExceededMessage(exceeded))
  return BUDGET_EXCEEDED
}
