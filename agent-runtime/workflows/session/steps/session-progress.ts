import { and, eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { agent } from '@/shared/db/schema'

interface SessionProgressInput {
  agentId: string
  sessionEpoch: number
  sessionRunId: string
}

interface SessionProgressState {
  lastSessionRunId: string | null
  sessionEpoch: number
  sessionEventRunId: string | null
}

export type SessionProgressEventType =
  | 'chat'
  | 'heartbeat'
  | 'reflection'
  | 'invocation'

export async function markSessionEventStarted(
  input: SessionProgressInput & {
    eventType: SessionProgressEventType
  }
): Promise<void> {
  'use step'
  const [updated] = await db
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
    .returning({ id: agent.id })

  if (updated) {
    return
  }

  const current = await readSessionProgressState(input.agentId)
  throw new Error(
    sessionProgressMismatchMessage('markSessionEventStarted', input, current)
  )
}

export async function clearSessionEventMarker(
  input: SessionProgressInput
): Promise<void> {
  'use step'
  const [updated] = await db
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
    .returning({ id: agent.id })

  if (updated) {
    return
  }

  const current = await readSessionProgressState(input.agentId)
  if (isSessionSuperseded(input, current) || !current?.sessionEventRunId) {
    return
  }

  throw new Error(
    sessionProgressMismatchMessage('clearSessionEventMarker', input, current)
  )
}

async function readSessionProgressState(
  agentId: string
): Promise<SessionProgressState | null> {
  const [row] = await db
    .select({
      lastSessionRunId: agent.lastSessionRunId,
      sessionEpoch: agent.sessionEpoch,
      sessionEventRunId: agent.sessionEventRunId,
    })
    .from(agent)
    .where(eq(agent.id, agentId))
    .limit(1)

  return row ?? null
}

function isSessionSuperseded(
  input: SessionProgressInput,
  current: SessionProgressState | null
): boolean {
  return (
    !current ||
    current.sessionEpoch !== input.sessionEpoch ||
    current.lastSessionRunId !== input.sessionRunId
  )
}

function sessionProgressMismatchMessage(
  operation: string,
  input: SessionProgressInput,
  current: SessionProgressState | null
): string {
  const currentState = current
    ? `current epoch=${current.sessionEpoch} lastSessionRunId=${
        current.lastSessionRunId ?? 'null'
      } sessionEventRunId=${current.sessionEventRunId ?? 'null'}`
    : 'agent row not found'

  return `${operation}: no current session row matched agent=${input.agentId} epoch=${input.sessionEpoch} run=${input.sessionRunId}; ${currentState}`
}
