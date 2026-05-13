import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { agent as agentTable } from '@/shared/db/schema'
import type { HeartbeatMode } from './messages'

export async function readPreviousHeartbeatCompletion(
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

export async function readPreviousDreamingCompletion(
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

export async function markBudgetSkippedRunCompleted(input: {
  agentId: string
  localDate: string
  mode: HeartbeatMode
}): Promise<void> {
  if (input.mode !== 'dreaming') {
    return
  }
  await markDreamingCompleted({
    agentId: input.agentId,
    localDate: input.localDate,
  })
}

export async function markRunCompleted(input: {
  agentId: string
  localDate: string
  mode: HeartbeatMode
}): Promise<void> {
  if (input.mode === 'dreaming') {
    await markDreamingCompleted({
      agentId: input.agentId,
      localDate: input.localDate,
    })
    return
  }
  await markHeartbeatCompleted(input.agentId)
}

async function markHeartbeatCompleted(agentId: string): Promise<void> {
  'use step'
  await db
    .update(agentTable)
    .set({
      lastHeartbeatAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(agentTable.id, agentId))
}

async function markDreamingCompleted(input: {
  agentId: string
  localDate: string
}): Promise<void> {
  'use step'
  await db
    .update(agentTable)
    .set({
      lastDreamingAt: new Date(),
      lastDreamingLocalDate: input.localDate,
      updatedAt: new Date(),
    })
    .where(eq(agentTable.id, input.agentId))
}
