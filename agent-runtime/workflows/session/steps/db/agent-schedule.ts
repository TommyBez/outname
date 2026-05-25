import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { agent as agentTable } from '@/shared/db/schema'
import type { HeartbeatMode } from '../../handlers/handle-heartbeat/messages'

export async function readPreviousHeartbeatCompletionStep(
  agentId: string
): Promise<string | null> {
  'use step'
  const [row] = await db
    .select({ lastHeartbeatAt: agentTable.lastHeartbeatAt })
    .from(agentTable)
    .where(eq(agentTable.id, agentId))
    .limit(1)
  return row?.lastHeartbeatAt ? row.lastHeartbeatAt.toISOString() : null
}

export async function readPreviousDreamingCompletionStep(
  agentId: string
): Promise<string | null> {
  'use step'
  const [row] = await db
    .select({ lastDreamingAt: agentTable.lastDreamingAt })
    .from(agentTable)
    .where(eq(agentTable.id, agentId))
    .limit(1)
  return row?.lastDreamingAt ? row.lastDreamingAt.toISOString() : null
}

export async function markBudgetSkippedRunCompletedStep(input: {
  agentId: string
  localDate: string
  mode: HeartbeatMode
}): Promise<void> {
  'use step'
  if (input.mode !== 'dreaming') {
    return
  }
  await markDreamingCompletedStep({
    agentId: input.agentId,
    localDate: input.localDate,
  })
}

export async function markRunCompletedStep(input: {
  agentId: string
  localDate: string
  mode: HeartbeatMode
}): Promise<void> {
  'use step'
  if (input.mode === 'dreaming') {
    await markDreamingCompletedStep({
      agentId: input.agentId,
      localDate: input.localDate,
    })
    return
  }
  await markHeartbeatCompletedStep(input.agentId)
}

async function markHeartbeatCompletedStep(agentId: string): Promise<void> {
  await db
    .update(agentTable)
    .set({
      lastHeartbeatAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(agentTable.id, agentId))
}

async function markDreamingCompletedStep(input: {
  agentId: string
  localDate: string
}): Promise<void> {
  await db
    .update(agentTable)
    .set({
      lastDreamingAt: new Date(),
      lastDreamingLocalDate: input.localDate,
      updatedAt: new Date(),
    })
    .where(eq(agentTable.id, input.agentId))
}
