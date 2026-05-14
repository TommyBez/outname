import type { ModelMessage, UIMessage } from 'ai'
import { getWorkflowMetadata } from 'workflow'
import { start } from 'workflow/api'
import { replyNamespaceForEvent } from '@/agent-runtime/server/agent-event-keys'
import type { AgentEventPayloads } from '@/agent-runtime/server/agent-event-store'
import { slackStreamForwarderWorkflow } from '@/channels/slack/server/stream-forwarder-workflow'
import { handleChat } from '../session/handlers/handle-chat'
import { handleHeartbeat } from '../session/handlers/handle-heartbeat'
import { handleInvocation } from '../session/handlers/handle-invocation'
import { cleanupEventResources } from './steps/cleanup-event'
import {
  loadAgentEventStep,
  markAgentEventHeartbeatStep,
  markAgentEventRunningStep,
  markAgentEventTerminalStep,
  setAgentEventPublisherWorkflowRunIdStep,
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

    const workflowRunId = currentWorkflowRunId(event.workflowRunId)
    await markAgentEventRunningStep({ eventId: event.id, workflowRunId })
    const publisherWorkflowRunId = await maybeStartPublisher({
      event,
      workflowRunId,
    })
    if (publisherWorkflowRunId) {
      await setAgentEventPublisherWorkflowRunIdStep({
        eventId: event.id,
        publisherWorkflowRunId,
      })
    }
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

async function maybeStartPublisher(input: {
  event: WorkflowAgentEvent
  workflowRunId: string | null
}): Promise<string | null> {
  'use step'
  if (!input.workflowRunId) {
    return null
  }
  const { event } = input
  if (event.type !== 'chat' || event.source !== 'slack') {
    return null
  }
  if (event.publisherWorkflowRunId) {
    return null
  }
  const payload = payloadAs<AgentEventPayloads['chat']>(event)
  if (!payload.slack) {
    return null
  }
  const run = await start(slackStreamForwarderWorkflow, [
    {
      ...payload.slack,
      eventId: event.id,
      replyNamespace: replyNamespaceForEvent(event.id),
      workflowRunId: input.workflowRunId,
    },
  ])
  return run.runId
}

async function dispatchAgentEvent(event: WorkflowAgentEvent): Promise<void> {
  await markAgentEventHeartbeatStep({ eventId: event.id })

  switch (event.type) {
    case 'chat': {
      const payload = payloadAs<AgentEventPayloads['chat']>(event)
      await handleChat({
        agentId: event.agentId,
        conversationId: payload.conversationId,
        modelMessages: payload.modelMessages as ModelMessage[] | undefined,
        replyToken: replyNamespaceForEvent(event.id),
        uiMessages: payload.uiMessages as UIMessage[],
      })
      return
    }
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
        parentRunId: payload.parentRunId ?? null,
        parentToolCallId: payload.parentToolCallId ?? null,
        parentToolId: payload.parentToolId ?? null,
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

function currentWorkflowRunId(fallback: string | null): string | null {
  try {
    const metadata = getWorkflowMetadata() as {
      runId?: string
      workflowRunId?: string
    }
    return metadata.runId ?? metadata.workflowRunId ?? fallback
  } catch {
    return fallback
  }
}
