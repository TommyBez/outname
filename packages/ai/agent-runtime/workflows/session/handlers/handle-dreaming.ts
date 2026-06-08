import { resolveDreamingConfig } from '@outname/ai/agent-runtime/memory-core/config'
import { renderDeterministicDiarySection } from '@outname/ai/agent-runtime/memory-core/diary'
import { emitActivity } from '@outname/ai/agent-runtime/server/run-events'
import { currentWorkflowRunId } from '@outname/shared/server/workflow-run-id'
import type { UIMessage } from 'ai'
import { recordTokenUsageStep } from '../steps/budget'
import { markRunCompletedStep } from '../steps/db/agent-schedule'
import { replaceAgentEventTranscriptMessagesBestEffortStep } from '../steps/db/event-transcript-store'
import { startupSystemSandboxStep } from '../steps/db/system-sandbox'
import {
  appendDreamDiaryStep,
  beginDreamingSweepStep,
  completeDreamingSweepStep,
  failDreamingSweepStep,
  runDeepPhaseStep,
  runDiaryNarrativeStep,
  runLightPhaseStep,
  runRemPhaseStep,
} from '../steps/dreaming/dreaming-steps'
import { finalizeRun } from '../steps/finalize-run'
import { initRun } from '../steps/init-run'
import { checkBudgetOrFinalize } from './handle-heartbeat/budget'

export async function handleDreaming(input: {
  agentId: string
  attempt?: number
  eventId: string
  localDate: string
  manual?: boolean
  scheduledAt?: string
  userId: string
}): Promise<void> {
  const runId = currentWorkflowRunId()
  const nowIso = input.scheduledAt ?? new Date().toISOString()
  const sweepId = `sweep_${input.eventId}`
  const config = resolveDreamingConfig()

  try {
    await initRun(runId)
    await emitActivity(runId, 'Dreaming: Preparing sweep', {
      manual: input.manual ?? false,
    })

    const budgetCheck = await checkBudgetOrFinalize({
      agentId: input.agentId,
      mode: 'dreaming',
      runId,
    })
    if (budgetCheck.kind === 'exceeded') {
      await replaceAgentEventTranscriptMessagesBestEffortStep({
        eventId: input.eventId,
        messages: [
          createAssistantTextMessage({
            id: `budget_refusal_${input.eventId}`,
            text: budgetCheck.message,
          }),
        ],
        userId: input.userId,
      })
      return
    }

    await emitActivity(runId, 'Dreaming: Starting sandbox')
    await startupSystemSandboxStep({ agentId: input.agentId })
    await beginDreamingSweepStep({
      agentId: input.agentId,
      attempt: input.attempt ?? 1,
      eventId: input.eventId,
      localDate: input.localDate,
      nowIso,
      sweepId,
    })

    let completedAt = nowIso
    try {
      await emitActivity(runId, 'Dreaming: Light phase')
      const light = await runLightPhaseStep({
        agentId: input.agentId,
        config,
        localDate: input.localDate,
        nowIso,
        sweepId,
        userId: input.userId,
      })

      await emitActivity(runId, 'Dreaming: REM phase')
      const rem = await runRemPhaseStep({
        agentId: input.agentId,
        config,
        nowIso,
        sweepId,
      })

      await emitActivity(runId, 'Dreaming: Deep phase')
      const deep = await runDeepPhaseStep({
        agentId: input.agentId,
        config,
        nowIso,
        sweepId,
      })

      completedAt = new Date().toISOString()
      const summary = { deep, light, rem, sweepId }
      const narrative = await runDiaryNarrativeStep({
        agentId: input.agentId,
        config,
        localDate: input.localDate,
        summary,
        userId: input.userId,
      })
      if (narrative?.usage.length) {
        await recordTokenUsageStep({
          agentId: input.agentId,
          generations: narrative.usage,
          inferenceProvider: narrative.inferenceProvider,
          model: narrative.model,
          rootAgentId: input.agentId,
          sourceId: runId,
          sourceType: 'dreaming',
          userId: input.userId,
        })
      }

      await emitActivity(runId, 'Dreaming: Writing diary')
      const section = renderDeterministicDiarySection({
        completedAt,
        localDate: input.localDate,
        summary,
      })
      await appendDreamDiaryStep({
        agentId: input.agentId,
        narrative: narrative?.text ?? null,
        section,
      })

      await completeDreamingSweepStep({
        agentId: input.agentId,
        completedAt,
        sweepId,
      })
      await markRunCompletedStep({
        agentId: input.agentId,
        localDate: input.localDate,
        mode: 'dreaming',
      })
      await replaceAgentEventTranscriptMessagesBestEffortStep({
        eventId: input.eventId,
        messages: [
          createAssistantTextMessage({
            id: `dreaming_summary_${input.eventId}`,
            text: `Dreaming complete. Light considered ${light.candidatesConsidered} candidates; REM wrote ${rem.signalsWritten} signals; Deep promoted ${deep.promotions.length} memories.`,
          }),
        ],
        userId: input.userId,
      })
      await finalizeRun(runId, 'completed', 'Dreaming complete')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await failDreamingSweepStep({
        agentId: input.agentId,
        error: message,
        failedAt: new Date().toISOString(),
        sweepId,
      })
      throw error
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await emitActivity(runId, 'Dreaming: Run failed', { message })
    await finalizeRun(runId, 'failed', message)
    throw error
  }
}

function createAssistantTextMessage(input: {
  id: string
  text: string
}): UIMessage {
  return {
    id: input.id,
    parts: [{ text: input.text, type: 'text' }],
    role: 'assistant',
  }
}
