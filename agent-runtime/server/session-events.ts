import 'server-only'
import type { ModelMessage, UIMessage } from 'ai'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import {
  type EnqueueAgentEventResult,
  enqueueAgentEvent,
} from '@/agent-runtime/server/agent-events'
import { db } from '@/shared/db'
import { type Agent, agent } from '@/shared/db/schema'

function workflowRunIdOrNull(result: EnqueueAgentEventResult): string | null {
  return result.workflowRunId
}

function workflowRunIdOrThrow(result: EnqueueAgentEventResult): string {
  if (!result.workflowRunId) {
    throw new Error(
      `Agent event ${result.eventId} was queued before a workflow run became available`
    )
  }
  return result.workflowRunId
}

export async function pokeHeartbeat(opts: {
  agent: Agent
}): Promise<{ eventId: string; sessionRunId: string | null }> {
  const result = await enqueueAgentEvent({
    agent: opts.agent,
    concurrencyKey: null,
    idempotencyKey: `manual:${opts.agent.id}:heartbeat:${nanoid(12)}`,
    payload: {
      manual: true,
      scheduledAt: new Date().toISOString(),
    },
    source: 'manual',
    type: 'heartbeat',
  })
  return {
    eventId: result.eventId,
    sessionRunId: workflowRunIdOrNull(result),
  }
}

export async function pokeDreaming(opts: {
  agent: Agent
  localDate: string
}): Promise<{ eventId: string; sessionRunId: string | null }> {
  const result = await enqueueAgentEvent({
    agent: opts.agent,
    concurrencyKey: null,
    idempotencyKey: `manual:${opts.agent.id}:dreaming:${nanoid(12)}`,
    payload: {
      localDate: opts.localDate,
      manual: true,
      scheduledAt: new Date().toISOString(),
    },
    source: 'manual',
    type: 'dreaming',
  })
  return {
    eventId: result.eventId,
    sessionRunId: workflowRunIdOrNull(result),
  }
}

export async function dispatchChatTurn(opts: {
  agent: Agent
  concurrencyKey?: string | null
  conversationId: string
  extraPayload?: Record<string, unknown>
  idempotencyKey?: string
  // Pre-converted model messages, populated by channel adapters that own the
  // thread (Chat SDK `toAiMessages`). When present, the workflow uses them
  // directly and skips converting `uiMessages`.
  modelMessages?: ModelMessage[]
  source?: 'chat' | 'slack'
  uiMessages: UIMessage[]
}): Promise<{
  eventId: string
  replyToken: string
  sessionRunId: string | null
  workflowRunId: string | null
}> {
  const messageId = opts.uiMessages.at(-1)?.id ?? nanoid(12)
  const result = await enqueueAgentEvent({
    agent: opts.agent,
    idempotencyKey:
      opts.idempotencyKey ??
      `chat:${opts.agent.id}:${opts.conversationId}:${messageId}`,
    payload: {
      conversationId: opts.conversationId,
      ...(opts.extraPayload ?? {}),
      modelMessages: opts.modelMessages,
      uiMessages: opts.uiMessages,
    },
    concurrencyKey: opts.concurrencyKey ?? null,
    source: opts.source ?? 'chat',
    type: 'chat',
  })
  return {
    eventId: result.eventId,
    replyToken: result.replyNamespace,
    sessionRunId: workflowRunIdOrNull(result),
    workflowRunId: result.workflowRunId,
  }
}

export async function dispatchInvocation(input: {
  childAgentId: string
  childUserId: string
  parentUserId: string
  parentAgentId: string
  parentRunId: string | null
  parentToolId: string
  parentToolCallId?: string | null
  instruction: string
  reportBackToParent?: boolean
  streamToken: string
  callStack: string[]
  depth: number
}): Promise<{ eventId: string; sessionRunId: string }> {
  if (input.childUserId !== input.parentUserId) {
    throw new Error(
      `dispatchInvocation: child ${input.childAgentId} does not belong to caller`
    )
  }

  const [child] = await db
    .select()
    .from(agent)
    .where(eq(agent.id, input.childAgentId))
    .limit(1)
  if (!child) {
    throw new Error(`dispatchInvocation: child ${input.childAgentId} not found`)
  }
  if (!child.enabled) {
    throw new Error(
      `dispatchInvocation: child ${input.childAgentId} is disabled`
    )
  }

  const result = await enqueueAgentEvent({
    agent: child,
    idempotencyKey: [
      'invocation',
      input.childAgentId,
      input.parentRunId ?? 'root',
      input.parentToolCallId ?? input.streamToken,
    ].join(':'),
    payload: {
      callStack: input.callStack,
      depth: input.depth,
      input: input.instruction,
      parentAgentId: input.parentAgentId,
      parentRunId: input.parentRunId,
      parentToolCallId: input.parentToolCallId ?? null,
      parentToolId: input.parentToolId,
      reportBackToParent: input.reportBackToParent ?? false,
      streamToken: input.streamToken,
    },
    source: 'invocation',
    type: 'invocation',
  })
  return {
    eventId: result.eventId,
    sessionRunId: workflowRunIdOrThrow(result),
  }
}
