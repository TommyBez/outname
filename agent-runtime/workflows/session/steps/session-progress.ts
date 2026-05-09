import { and, eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { agent } from '@/shared/db/schema'

export type SessionProgressEventType =
  | 'chat'
  | 'heartbeat'
  | 'reflection'
  | 'invocation'

export async function markSessionEventStarted(input: {
  agentId: string
  eventType: SessionProgressEventType
  sessionEpoch: number
  sessionRunId: string
}): Promise<void> {
  'use step'
  await db
    .update(agent)
    .set({
      sessionEventRunId: input.sessionRunId,
      sessionEventStartedAt: new Date(),
      sessionEventType: input.eventType,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(agent.id, input.agentId),
        eq(agent.sessionEpoch, input.sessionEpoch),
        eq(agent.lastSessionRunId, input.sessionRunId)
      )
    )
}

export async function clearSessionEventMarker(input: {
  agentId: string
  sessionEpoch: number
  sessionRunId: string
}): Promise<void> {
  'use step'
  await db
    .update(agent)
    .set({
      sessionEventRunId: null,
      sessionEventStartedAt: null,
      sessionEventType: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(agent.id, input.agentId),
        eq(agent.sessionEpoch, input.sessionEpoch),
        eq(agent.lastSessionRunId, input.sessionRunId),
        eq(agent.sessionEventRunId, input.sessionRunId)
      )
    )
}
