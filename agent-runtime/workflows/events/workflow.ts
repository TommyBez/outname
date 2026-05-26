import { replyNamespaceForEvent } from '@/agent-runtime/server/agent-event-keys'
import type { AgentEventPayloads } from '@/agent-runtime/server/agent-event-store'
import { currentWorkflowRunId } from '@/shared/server/workflow-run-id'
import { handleHeartbeat } from '../session/handlers/handle-heartbeat'
import { handleInvocation } from '../session/handlers/handle-invocation'
import { cleanupEventResources } from './steps/cleanup-event'
import {
  loadAgentEventStep,
  markAgentEventHeartbeatStep,
  markAgentEventRunningStep,
  markAgentEventTerminalStep,
  type WorkflowAgentEvent,
} from './steps/event-store'
import { startNextQueuedEvent } from './steps/start-next-event'

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
        manual: payload.manual ?? false,
        mode: 'normal',
        replyToken: replyNamespaceForEvent(event.id),
        scheduledAt: payload.scheduledAt,
      })
      return
    }
    case 'dreaming': {
      const payload = payloadAs<AgentEventPayloads['dreaming']>(event)
      await handleHeartbeat({
        agentId: event.agentId,
        localDate: payload.localDate,
        manual: payload.manual ?? false,
        mode: 'dreaming',
        replyToken: replyNamespaceForEvent(event.id),
        scheduledAt: payload.scheduledAt,
      })
      return
    }
    case 'invocation': {
      const payload = payloadAs<AgentEventPayloads['invocation']>(event)
      await handleInvocation({
        agentId: event.agentId,
        callStack: payload.callStack,
        depth: payload.depth,
        input: payload.input,
        parentAgentId: payload.parentAgentId ?? null,
        parentRunId: payload.parentRunId ?? null,
        parentToolCallId: payload.parentToolCallId ?? null,
        parentToolId: payload.parentToolId ?? null,
        reportBackToParent: payload.reportBackToParent ?? false,
        parentStream: null,
        replyToken: replyNamespaceForEvent(event.id),
        streamToken: payload.streamToken,
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
