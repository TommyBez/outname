import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { pendingFileWrites } from '@/shared/db/schema'
import { getAgentByIdForUser, getAgentMemoryFile } from '@/shared/server/data'

export async function getCurrent(agentId: string, userId: string) {
  const agentRow = await getAgentByIdForUser(agentId, userId)
  if (!agentRow) {
    throw new Error('Not found')
  }
  const [identityCard, soul, instructions, userProfile] = await Promise.all([
    resolveBootstrap(agentId, 'IDENTITY.md'),
    resolveBootstrap(agentId, 'SOUL.md'),
    resolveBootstrap(agentId, 'AGENTS.md'),
    resolveBootstrap(agentId, 'USER.md'),
  ])
  return {
    name: agentRow.name,
    model: agentRow.model,
    heartbeatEnabled: agentRow.heartbeatEnabled,
    heartbeatIntervalMinutes: agentRow.heartbeatIntervalMinutes,
    dreamingEnabled: agentRow.dreamingEnabled,
    dreamingIntervalMinutes: agentRow.dreamingIntervalMinutes,
    stepLimitMode: (agentRow.stepLimitMode ?? 'medium') as
      | 'custom'
      | 'grind'
      | 'high'
      | 'low'
      | 'medium',
    stepLimitCustom: agentRow.stepLimitCustom,
    identityCard,
    soul,
    instructions,
    userProfile,
  }
}

async function resolveBootstrap(agentId: string, path: string) {
  const [latest] = await db
    .select()
    .from(pendingFileWrites)
    .where(
      and(
        eq(pendingFileWrites.agentId, agentId),
        eq(pendingFileWrites.path, path)
      )
    )
    .orderBy(desc(pendingFileWrites.enqueuedAt))
    .limit(1)
  if (latest) {
    return latest.content
  }
  const file = await getAgentMemoryFile({ agentId, path })
  return file?.content ?? ''
}
