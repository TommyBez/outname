import { emitActivity } from '@outname/ai/agent-runtime/server/run-events'
import type { Agent } from '@outname/db/schema'
import { formatBudgetExceededMessage } from '@outname/shared/budgets/server/errors'
import { nonRetryableStepError } from '@outname/shared/server/workflow-step-errors'
import { preflightBudget } from '../../steps/budget'
import { loadAgentStep } from '../../steps/db/load-agent'
import { finalizeRun } from '../../steps/finalize-run'

type HeartbeatMode = 'normal' | 'dreaming'

export type HeartbeatBudgetCheckResult =
  | {
      agentRow: Agent
      kind: 'continue'
      userId: string
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
  if (!agentRow) {
    throw nonRetryableStepError(
      `checkBudgetOrFinalize: agent ${agentId} not found`
    )
  }
  const userId = agentRow.userId
  const exceeded = await preflightBudget({
    userId,
    rootAgentId: agentId,
  })
  if (!exceeded) {
    return {
      agentRow,
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

function activityMessage(mode: HeartbeatMode, message: string): string {
  return mode === 'dreaming' ? `Dreaming: ${message}` : message
}
