import 'server-only'
import {
  enqueueAgentEventWithStarter,
  type StartAgentEventWorkflowRun,
} from '@outname/ai/agent-runtime/server/agent-event-start'
import { db } from '@outname/db'
import { agent } from '@outname/db/schema'
import {
  delayedRetryStepError,
  nonRetryableStepError,
} from '@outname/shared/server/workflow-step-errors'
import { and, eq } from 'drizzle-orm'

function workflowRunIdOrThrow(input: {
  eventId: string
  workflowRunId: string | null
}): string {
  if (!input.workflowRunId) {
    throw delayedRetryStepError(
      `Agent event ${input.eventId} was queued before a workflow run became available`,
      { retryAfter: '1s' }
    )
  }
  return input.workflowRunId
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
  startWorkflowRun: StartAgentEventWorkflowRun
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

  const result = await enqueueAgentEventWithStarter(
    {
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
    },
    input.startWorkflowRun
  )
  return {
    eventId: result.eventId,
    sessionRunId: workflowRunIdOrThrow(result),
  }
}
