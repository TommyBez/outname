import 'server-only'
import { dreamingConcurrencyKey } from '@outname/ai/agent-runtime/server/agent-event-keys'
import { findActiveOrQueuedDreamingEventForAgent } from '@outname/ai/agent-runtime/server/agent-event-store'
import {
  type EnqueueAgentEventResult,
  enqueueAgentEvent,
} from '@outname/ai/agent-runtime/server/agent-events'
import type { Agent } from '@outname/db/schema'
import { nanoid } from 'nanoid'

function workflowRunIdOrNull(result: EnqueueAgentEventResult): string | null {
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
  const existing = await findActiveOrQueuedDreamingEventForAgent(opts.agent.id)
  if (existing) {
    return {
      eventId: existing.id,
      sessionRunId: existing.workflowRunId,
    }
  }

  const result = await enqueueAgentEvent({
    agent: opts.agent,
    concurrencyKey: dreamingConcurrencyKey(opts.agent.id),
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
