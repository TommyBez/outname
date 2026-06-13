import 'server-only'
import { enqueueAgentEvent } from '@outname/ai/agent-runtime/server/agent-events'
import type { Agent } from '@outname/db/schema'
import { nanoid } from 'nanoid'

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
    sessionRunId: result.workflowRunId,
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
    sessionRunId: result.workflowRunId,
  }
}
