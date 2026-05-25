import 'server-only'

import { eq } from 'drizzle-orm'
import { revalidateTag } from 'next/cache'
import { db } from '@/shared/db/pool'
import { agent } from '@/shared/db/schema'
import {
  agentTag,
  agentToolsTag,
  userAgentsTag,
} from '@/shared/server/cache-tags'

export async function assertAgentOwnership(
  agentId: string,
  userId: string
): Promise<void> {
  const [row] = await db
    .select({ userId: agent.userId })
    .from(agent)
    .where(eq(agent.id, agentId))
    .limit(1)

  if (!row) {
    throw new Error('Agent not found.')
  }
  if (row.userId !== userId) {
    throw new Error('Forbidden.')
  }
}

export function revalidateAgentToolSurfaces(
  agentId: string,
  userId: string
): void {
  revalidateTag(agentToolsTag(agentId), 'max')
  revalidateTag(agentTag(agentId), 'max')
  revalidateTag(userAgentsTag(userId), 'max')
}

export function ownershipError(err: unknown): string {
  return err instanceof Error ? err.message : 'Forbidden.'
}
