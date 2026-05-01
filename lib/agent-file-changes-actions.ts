'use server'

import { and, eq } from 'drizzle-orm'
import { revalidateTag } from 'next/cache'
import { requireUserId } from '@/lib/auth-guard'
import { agentTag } from '@/lib/cache-tags'
import { db } from '@/lib/db'
import { agent, agentFileChanges } from '@/lib/db/schema'

export async function markFileChangeReviewedAction(
  changeId: string
): Promise<{ error?: string; ok: boolean }> {
  const userId = await requireUserId()
  const [change] = await db
    .select({ agentId: agentFileChanges.agentId })
    .from(agentFileChanges)
    .innerJoin(agent, eq(agent.id, agentFileChanges.agentId))
    .where(and(eq(agentFileChanges.id, changeId), eq(agent.userId, userId)))
    .limit(1)

  if (!change) {
    return { ok: false, error: 'File change not found.' }
  }

  await db
    .update(agentFileChanges)
    .set({ reviewedAt: new Date() })
    .where(eq(agentFileChanges.id, changeId))

  revalidateTag(agentTag(change.agentId), 'max')
  return { ok: true }
}
