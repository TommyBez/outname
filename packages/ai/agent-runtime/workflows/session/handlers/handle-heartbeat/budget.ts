import { emitActivity } from '@outname/ai/agent-runtime/server/run-events'
import { formatBudgetExceededMessage } from '@outname/shared/budgets/server/errors'
import { preflightBudget } from '../../steps/budget'
import { loadAgentStep } from '../../steps/db/load-agent'
import { finalizeRun } from '../../steps/finalize-run'
import { activityMessage, type HeartbeatMode } from './messages'

export type HeartbeatBudgetCheckResult =
  | {
      kind: 'continue'
      userId: string | null
    }
  | {
      kind: 'exceeded'
      message: string
    }

export async function checkBudgetOrFinalize(input: {
  agentId: string
  mode: HeartbeatMode
  runId: string
}): Promise<HeartbeatBudgetCheckResult> {
  const { agentId, mode, runId } = input
  const agentRow = await loadAgentStep({ agentId })
  const userId = agentRow?.userId ?? null
  if (!userId) {
    return {
      kind: 'continue',
      userId: null,
    }
  }
  const exceeded = await preflightBudget({
    userId,
    rootAgentId: agentId,
  })
  if (!exceeded) {
    return {
      kind: 'continue',
      userId,
    }
  }
  const message = formatBudgetExceededMessage(exceeded)
  await emitActivity(
    runId,
    activityMessage(mode, 'Budget exceeded, skipping run'),
    {
      period: exceeded.period,
      scope: exceeded.scope.type,
    }
  )
  await finalizeRun(runId, 'completed', message)
  return {
    kind: 'exceeded',
    message,
  }
}
