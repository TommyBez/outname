import { replyNamespaceForEvent } from '@outname/ai/agent-runtime/server/agent-event-keys'
import type { AgentEventPayloads } from '@outname/ai/agent-runtime/server/agent-event-store'
import { cleanupEventResources } from '@outname/ai/agent-runtime/workflows/events/steps/cleanup-event'
import {
  loadAgentEventStep,
  markAgentEventHeartbeatStep,
  markAgentEventRunningStep,
  markAgentEventTerminalStep,
  type WorkflowAgentEvent,
} from '@outname/ai/agent-runtime/workflows/events/steps/event-store'
import { startNextQueuedEventForWorkflow } from '@outname/ai/agent-runtime/workflows/events/steps/start-next-queued-event'
import { handleDreaming } from '@outname/ai/agent-runtime/workflows/session/handlers/handle-dreaming'
import { handleHeartbeat } from '@outname/ai/agent-runtime/workflows/session/handlers/handle-heartbeat'
import { handleInvocation } from '@outname/ai/agent-runtime/workflows/session/handlers/handle-invocation'
import { buildWorkflowAgentTool } from '@outname/ai/tools/sub-agents/workflow-agent-tool'
import { start } from '@outname/workflow/api'
import { currentWorkflowRunId } from '@outname/workflow/runtime'

export async function agentEventWorkflow(input: {
  eventId: string
}): Promise<void> {
  'use workflow'
  let event: WorkflowAgentEvent | null = null
  try {
    event = await loadAgentEventStep({ eventId: input.eventId })
    if (!(event && ['starting', 'running'].includes(event.status))) {
      return
    }

    const workflowRunId = currentWorkflowRunId()
    await markAgentEventRunningStep({ eventId: event.id, workflowRunId })
    await dispatchAgentEvent(event)
    await markAgentEventTerminalStep({
      eventId: event.id,
      status: 'completed',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await markAgentEventTerminalStep({
      eventId: event?.id ?? input.eventId,
      lastError: message,
      status: 'failed',
    })
    throw err
  } finally {
    if (event) {
      await cleanupEventResources({ agentId: event.agentId })
      await startNextQueuedEvent({ concurrencyKey: event.concurrencyKey })
    }
  }
}

async function dispatchAgentEvent(event: WorkflowAgentEvent): Promise<void> {
  await markAgentEventHeartbeatStep({ eventId: event.id })

  switch (event.type) {
    case 'heartbeat': {
      const payload = payloadAs<AgentEventPayloads['heartbeat']>(event)
      await handleHeartbeat({
        agentId: event.agentId,
        buildSubAgentTool: buildWorkflowSubAgentTool,
        eventId: event.id,
        manual: payload.manual ?? false,
        mode: 'normal',
        replyToken: replyNamespaceForEvent(event.id),
        scheduledAt: payload.scheduledAt,
        userId: event.userId,
      })
      return
    }
    case 'dreaming': {
      const payload = payloadAs<AgentEventPayloads['dreaming']>(event)
      await handleDreaming({
        agentId: event.agentId,
        attempt: event.attempt,
        eventId: event.id,
        localDate: payload.localDate,
        manual: payload.manual ?? false,
        scheduledAt: payload.scheduledAt,
        userId: event.userId,
      })
      return
    }
    case 'invocation': {
      const payload = payloadAs<AgentEventPayloads['invocation']>(event)
      await handleInvocation({
        agentId: event.agentId,
        buildSubAgentTool: buildWorkflowSubAgentTool,
        callStack: payload.callStack,
        depth: payload.depth,
        eventId: event.id,
        input: payload.input,
        parentRunId: payload.parentRunId ?? null,
        parentToolCallId: payload.parentToolCallId ?? null,
        parentToolId: payload.parentToolId ?? null,
        parentStream: null,
        replyToken: replyNamespaceForEvent(event.id),
        streamToken: payload.streamToken,
        userId: event.userId,
      })
      return
    }
    default: {
      const exhaustive: never = event.type
      throw new Error(`Unsupported agent event type: ${exhaustive}`)
    }
  }
}

function payloadAs<T>(event: WorkflowAgentEvent): T {
  return event.payload as T
}

const buildWorkflowSubAgentTool = buildWorkflowAgentTool

async function startCurrentAgentEventWorkflowRun(
  eventId: string
): Promise<string> {
  const run = await start(agentEventWorkflow, [{ eventId }])
  return run.runId
}

export async function startNextQueuedEvent(input: {
  concurrencyKey: string | null
}): Promise<void> {
  'use step'
  if (!input.concurrencyKey) {
    return
  }
  await startNextQueuedEventForWorkflow({
    concurrencyKey: input.concurrencyKey,
    startWorkflowRun: startCurrentAgentEventWorkflowRun,
  })
}
