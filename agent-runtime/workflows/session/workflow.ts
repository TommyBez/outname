import { createHook } from 'workflow'
import { type SessionEvent, sessionToken } from './events'
import { handleChat } from './handlers/handle-chat'
import { handleHeartbeat } from './handlers/handle-heartbeat'
import { handleInvocation } from './handlers/handle-invocation'
import { endOfEvent } from './steps/end-of-event'
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
  | { sourceType: 'reflection'; sourceId: string | null }
  | { sourceType: 'invocation'; sourceId: string | null }

interface EventDispatchResult {
  pending: PendingWrites
  source: EventSource
}

const FALLBACK_SOURCE: EventSource = {
  sourceType: 'heartbeat',
  sourceId: null,
}

/**
 * Long-lived "session" workflow — one running run per `enabled = true`
 * agent.
 *
 *   1. Boot a sibling ticker workflow that drives heartbeat events.
 *   2. Open the session hook and spin a for-await loop pulling
 *      `SessionEvent`s.
 *   3. Dispatch each event to its handler (`chat` / `heartbeat`),
 *      acking the ticker after each heartbeat completes so the next
 *      tick is gated on this one. Each handler returns the per-event
 *      tracker for immediate file writes.
 *   4. After every event, run `endOfEvent` to:
 *        - persist review rows for tracked architecture-file writes,
 *        - mirror tracked architecture files into `agent_files`,
 *        - shut both sandboxes so Vercel snapshots their filesystems.
 *      If a handler threw, we still call `endOfEvent` with a fresh
 *      empty queue so the sandboxes get released cleanly.
 *   5. On shutdown, cancel the ticker workflow.
 *
 * Phase 2 drops the `kind` argument: every agent is generic, the
 * handlers read whatever they need (system prompt, model, persona
 * files) from the agent row + system sandbox at event time.
 */
export async function agentSessionWorkflow(input: {
  agentId: string
}): Promise<void> {
  'use workflow'
  const { agentId } = input

  // Defend against the "previous session crashed mid-handler and left
  // its ticker hanging on its ackHook" failure mode before we start a
  // fresh ticker on top of it.
  await reapOrphanTicker({ agentId })

  const { tickerRunId } = await startTicker({ agentId })

  try {
    const hook = createHook<SessionEvent>({
      token: sessionToken(agentId),
    })

    for await (const event of hook) {
      if (event.type === 'shutdown') {
        break
      }

      let result: EventDispatchResult = {
        pending: createPendingWrites(),
        source: FALLBACK_SOURCE,
      }

      try {
        result = await dispatchSessionEvent({ agentId, event })
      } catch (err) {
        // Handlers own their own workflow-level breadcrumbs. We log here for
        // observability and continue the loop — one bad event must not
        // poison the long-lived session.
        console.error('[v0] agentSessionWorkflow: handler failed', err)
      }

      await endOfEvent({
        agentId,
        pending: result.pending,
        source: result.source,
      })
    }
  } finally {
    await stopTicker({ agentId, tickerRunId })
  }
}

async function dispatchSessionEvent(input: {
  agentId: string
  event: Exclude<SessionEvent, { type: 'shutdown' }>
}): Promise<EventDispatchResult> {
  const { agentId, event } = input
  switch (event.type) {
    case 'chat':
      return await dispatchChatEvent({ agentId, event })
    case 'heartbeat':
      return await dispatchHeartbeatEvent({ agentId, event })
    case 'reflection':
      return await dispatchReflectionEvent({ agentId, event })
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
}): Promise<EventDispatchResult> {
  const { agentId, event } = input
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
    await ackIfNeeded({ agentId, ack: event.ack })
  }
}

async function dispatchReflectionEvent(input: {
  agentId: string
  event: Extract<SessionEvent, { type: 'reflection' }>
}): Promise<EventDispatchResult> {
  const { agentId, event } = input
  try {
    const result = await handleHeartbeat({
      agentId,
      localDate: event.localDate,
      manual: event.manual ?? false,
      mode: 'reflection',
      scheduledAt: event.scheduledAt,
    })
    return {
      pending: result.pending,
      source: { sourceType: 'reflection', sourceId: result.runId },
    }
  } finally {
    await ackIfNeeded({ agentId, ack: event.ack })
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
}): Promise<void> {
  if (!input.ack) {
    return
  }
  await ackHeartbeat({ agentId: input.agentId, ack: input.ack })
}
