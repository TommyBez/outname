import 'server-only'

import { db } from '@outname/db'
import { agent } from '@outname/db/schema'
import {
  agentTag,
  agentToolsTag,
  userAgentsTag,
} from '@outname/shared/server/cache-tags'
import { eq } from 'drizzle-orm'
import { revalidateTag } from 'next/cache'

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
