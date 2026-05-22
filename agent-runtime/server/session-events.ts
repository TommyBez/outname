import 'server-only'
import { and, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import {
  type EnqueueAgentEventResult,
  enqueueAgentEvent,
} from '@/agent-runtime/server/agent-events'
import { db } from '@/shared/db'
import { type Agent, agent } from '@/shared/db/schema'
import {
  delayedRetryStepError,
  nonRetryableStepError,
} from '@/shared/server/workflow-step-errors'

function workflowRunIdOrNull(result: EnqueueAgentEventResult): string | null {
  return result.workflowRunId
}

function workflowRunIdOrThrow(result: EnqueueAgentEventResult): string {
  if (!result.workflowRunId) {
    throw delayedRetryStepError(
      `Agent event ${result.eventId} was queued before a workflow run became available`,
      { retryAfter: '1s' }
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

export async function dispatchInvocation(input: {
  childAgentId: string
  childUserId: string
  parentUserId: string
  parentRunId: string | null
  parentToolId: string
  parentToolCallId?: string | null
  instruction: string
  streamToken: string
  callStack: string[]
  depth: number
}): Promise<{ eventId: string; sessionRunId: string }> {
  if (input.childUserId !== input.parentUserId) {
    throw nonRetryableStepError(
      `dispatchInvocation: child ${input.childAgentId} does not belong to caller`
    )
  }

  const [child] = await db
    .select()
    .from(agent)
    .where(
      and(
        eq(agent.id, input.childAgentId),
        eq(agent.userId, input.parentUserId)
      )
    )
    .limit(1)
  if (!child) {
    throw nonRetryableStepError(
      `dispatchInvocation: child ${input.childAgentId} not found`
    )
  }
  if (!child.enabled) {
    throw nonRetryableStepError(
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
      parentRunId: input.parentRunId,
      parentToolCallId: input.parentToolCallId ?? null,
      parentToolId: input.parentToolId,
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
