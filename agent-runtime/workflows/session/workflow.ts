import { createHook, getWorkflowMetadata } from 'workflow'
import { type SessionEvent, sessionToken } from './events'
import { handleChat } from './handlers/handle-chat'
import { handleHeartbeat } from './handlers/handle-heartbeat'
import { handleInvocation } from './handlers/handle-invocation'
import { endOfEvent } from './steps/end-of-event'
import {
  clearSessionEventMarker,
  markSessionEventStarted,
} from './steps/session-progress'
import {
  ackHeartbeat,
  reapOrphanTicker,
  startTicker,
  stopTicker,
} from './steps/ticker-control'
import { createPendingWrites, type PendingWrites } from './tools/pending-writes'

type EventSource =
  | { sourceType: 'chat'; sourceId: string }
  | { sourceType: 'heartbeat'; sourceId: string | null }
  | { sourceType: 'dreaming'; sourceId: string | null }
  | { sourceType: 'invocation'; sourceId: string | null }

interface EventDispatchResult {
  pending: PendingWrites
  source: EventSource
}

const FALLBACK_SOURCE: EventSource = {
  sourceType: 'heartbeat',
  sourceId: null,
}

// Long-lived per-agent session loop: run the ticker, dispatch hook events,
// always call `endOfEvent`, and stop the ticker on shutdown.
export async function agentSessionWorkflow(input: {
  agentId: string
  sessionEpoch: number
}): Promise<void> {
  'use workflow'
  const { agentId, sessionEpoch } = input
  const sessionRunId = await currentWorkflowRunId()

  // Reap a ticker left behind by a previous crashed session before starting a new one.
  await reapOrphanTicker({ agentId, sessionEpoch })

  const { tickerRunId } = await startTicker({ agentId, sessionEpoch })

  try {
    const hook = createHook<SessionEvent>({
      token: sessionToken(agentId, sessionEpoch),
    })

    for await (const event of hook) {
      if (event.type === 'shutdown') {
        break
      }

      await markSessionEventStarted({
        agentId,
        eventType: event.type,
        sessionEpoch,
        sessionRunId,
      })

      let result: EventDispatchResult = {
        pending: createPendingWrites(),
        source: FALLBACK_SOURCE,
      }

      try {
        result = await dispatchSessionEvent({ agentId, event, sessionEpoch })
      } catch (err) {
        // One bad event must not poison the long-lived session loop.
        console.error('[v0] agentSessionWorkflow: handler failed', err)
      }

      await endOfEvent({
        agentId,
        pending: result.pending,
        source: result.source,
      })
      await clearSessionEventMarker({ agentId, sessionEpoch, sessionRunId })
    }
  } finally {
    await stopTicker({ agentId, tickerRunId })
  }
}

async function dispatchSessionEvent(input: {
  agentId: string
  event: Exclude<SessionEvent, { type: 'shutdown' }>
  sessionEpoch: number
}): Promise<EventDispatchResult> {
  const { agentId, event, sessionEpoch } = input
  switch (event.type) {
    case 'chat':
      return await dispatchChatEvent({ agentId, event })
    case 'heartbeat':
      return await dispatchHeartbeatEvent({ agentId, event, sessionEpoch })
    case 'dreaming':
      return await dispatchDreamingEvent({ agentId, event, sessionEpoch })
    case 'invocation':
      return await dispatchInvocationEvent({ agentId, event })
    default: {
      const _exhaustive: never = event
      throw new Error(
        `Unsupported session event: ${JSON.stringify(_exhaustive)}`
      )
    }
  }
}

async function dispatchChatEvent(input: {
  agentId: string
  event: Extract<SessionEvent, { type: 'chat' }>
}): Promise<EventDispatchResult> {
  const { agentId, event } = input
  const result = await handleChat({
    agentId,
    conversationId: event.conversationId,
    replyToken: event.replyToken,
    uiMessages: event.uiMessages,
  })
  return {
    pending: result.pending,
    source: { sourceType: 'chat', sourceId: event.conversationId },
  }
}

async function dispatchHeartbeatEvent(input: {
  agentId: string
  event: Extract<SessionEvent, { type: 'heartbeat' }>
  sessionEpoch: number
}): Promise<EventDispatchResult> {
  const { agentId, event, sessionEpoch } = input
  try {
    const result = await handleHeartbeat({
      agentId,
      manual: event.manual ?? false,
      mode: 'normal',
      scheduledAt: event.scheduledAt,
    })
    return {
      pending: result.pending,
      source: { sourceType: 'heartbeat', sourceId: result.runId },
    }
  } finally {
    await ackIfNeeded({ agentId, ack: event.ack, sessionEpoch })
  }
}

async function dispatchDreamingEvent(input: {
  agentId: string
  event: Extract<SessionEvent, { type: 'dreaming' }>
  sessionEpoch: number
}): Promise<EventDispatchResult> {
  const { agentId, event, sessionEpoch } = input
  try {
    const result = await handleHeartbeat({
      agentId,
      localDate: event.localDate,
      manual: event.manual ?? false,
      mode: 'dreaming',
      scheduledAt: event.scheduledAt,
    })
    return {
      pending: result.pending,
      source: { sourceType: 'dreaming', sourceId: result.runId },
    }
  } finally {
    await ackIfNeeded({ agentId, ack: event.ack, sessionEpoch })
  }
}

async function dispatchInvocationEvent(input: {
  agentId: string
  event: Extract<SessionEvent, { type: 'invocation' }>
}): Promise<EventDispatchResult> {
  const { agentId, event } = input
  const result = await handleInvocation({
    agentId,
    callStack: event.callStack,
    depth: event.depth,
    input: event.input,
    parentStream: event.parentStream,
    parentToolCallId: event.parentToolCallId,
    parentRunId: event.parentRunId,
    parentToolId: event.parentToolId,
    streamToken: event.streamToken,
  })
  return {
    pending: result.pending,
    source: { sourceType: 'invocation', sourceId: result.runId },
  }
}

async function ackIfNeeded(input: {
  ack?: string
  agentId: string
  sessionEpoch: number
}): Promise<void> {
  if (!input.ack) {
    return
  }
  await ackHeartbeat({
    agentId: input.agentId,
    ack: input.ack,
    sessionEpoch: input.sessionEpoch,
  })
}

async function currentWorkflowRunId(): Promise<string> {
  'use step'
  await Promise.resolve()

  const metadata = getWorkflowMetadata() as {
    runId?: unknown
    workflowRunId?: unknown
  }
  const runId =
    nonEmptyString(metadata.runId) ?? nonEmptyString(metadata.workflowRunId)

  if (!runId) {
    throw new Error('currentWorkflowRunId: workflow metadata has no run id')
  }

  return runId
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}
