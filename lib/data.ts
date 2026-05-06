import 'server-only'
import { and, desc, eq } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'
import {
  agentSkillsTag,
  agentTag,
  agentToolsTag,
  userAgentsTag,
  userConnectionsTag,
} from '@/lib/cache-tags'
import { db } from '@/lib/db'
import {
  type Agent,
  type AgentFile,
  type AgentFileChange,
  type AgentSkill,
  type AgentSkillFile,
  type AgentTool,
  agent,
  agentFileChanges,
  agentFiles,
  agentSkillFiles,
  agentSkills,
  agentTools,
  type UserConnection,
  userConnections,
} from '@/lib/db/schema'

export async function getAgentsForUser(userId: string): Promise<Agent[]> {
  return await db
    .select()
    .from(agent)
    .where(eq(agent.userId, userId))
    .orderBy(desc(agent.createdAt))
}

export async function getCachedAgentsForUser(userId: string): Promise<Agent[]> {
  'use cache'

  cacheLife('minutes')
  cacheTag(userAgentsTag(userId))
  return await getAgentsForUser(userId)
}

/**
 * Owner-scoped row lookup used by route handlers and other request-time
 * paths that should bypass the cross-request cache.
 */
export async function getAgentByIdForUser(
  agentId: string,
  userId: string
): Promise<Agent | null> {
  const [row] = await db
    .select()
    .from(agent)
    .where(and(eq(agent.id, agentId), eq(agent.userId, userId)))
    .limit(1)
  return row ?? null
}

export async function getCachedAgentByIdForUser(
  agentId: string,
  userId: string
): Promise<Agent | null> {
  'use cache'

  cacheLife('minutes')
  cacheTag(userAgentsTag(userId), agentTag(agentId))
  return await getAgentByIdForUser(agentId, userId)
}

export async function getAgentLogFiles(agentId: string): Promise<AgentFile[]> {
  const rows = await db
    .select()
    .from(agentFiles)
    .where(eq(agentFiles.agentId, agentId))
    .orderBy(desc(agentFiles.path))
  return rows.filter((row) => row.path.startsWith('logs/'))
}

export async function getCachedAgentLogFiles(
  agentId: string
): Promise<AgentFile[]> {
  'use cache'

  cacheLife('minutes')
  cacheTag(agentTag(agentId))
  return await getAgentLogFiles(agentId)
}

export async function getAgentMemoryFile(input: {
  agentId: string
  path: string
}): Promise<AgentFile | null> {
  const [row] = await db
    .select()
    .from(agentFiles)
    .where(
      and(
        eq(agentFiles.agentId, input.agentId),
        eq(agentFiles.path, input.path)
      )
    )
    .limit(1)
  return row ?? null
}

export async function getCachedAgentMemoryFile(input: {
  agentId: string
  path: string
}): Promise<AgentFile | null> {
  'use cache'

  cacheLife('minutes')
  cacheTag(agentTag(input.agentId))
  return await getAgentMemoryFile(input)
}

export async function getAgentFileChanges(input: {
  agentId: string
  limit?: number
  path?: string
}): Promise<AgentFileChange[]> {
  const filters = [eq(agentFileChanges.agentId, input.agentId)]
  if (input.path) {
    filters.push(eq(agentFileChanges.path, input.path))
  }
  return await db
    .select()
    .from(agentFileChanges)
    .where(and(...filters))
    .orderBy(desc(agentFileChanges.createdAt))
    .limit(input.limit ?? 50)
}

export async function getCachedAgentFileChanges(input: {
  agentId: string
  limit?: number
  path?: string
}): Promise<AgentFileChange[]> {
  'use cache'

  cacheLife('minutes')
  cacheTag(agentTag(input.agentId))
  return await getAgentFileChanges(input)
}

export async function getUserConnections(
  userId: string
): Promise<UserConnection[]> {
  return await db
    .select()
    .from(userConnections)
    .where(eq(userConnections.userId, userId))
    .orderBy(desc(userConnections.updatedAt))
}

export async function getCachedUserConnections(
  userId: string
): Promise<UserConnection[]> {
  'use cache'

  cacheLife('minutes')
  cacheTag(userConnectionsTag(userId))
  return await getUserConnections(userId)
}

export async function getAgentTools(agentId: string): Promise<AgentTool[]> {
  return await db
    .select()
    .from(agentTools)
    .where(eq(agentTools.agentId, agentId))
    .orderBy(desc(agentTools.updatedAt))
}

export async function getCachedAgentTools(
  agentId: string
): Promise<AgentTool[]> {
  'use cache'

  cacheLife('minutes')
  cacheTag(agentToolsTag(agentId))
  return await getAgentTools(agentId)
}

export interface AgentSkillSummary extends AgentSkill {
  fileCount: number
}

export async function getAgentSkillSummaries(
  agentId: string
): Promise<AgentSkillSummary[]> {
  const [skills, files] = await Promise.all([
    db
      .select()
      .from(agentSkills)
      .where(eq(agentSkills.agentId, agentId))
      .orderBy(desc(agentSkills.updatedAt)),
    db
      .select({
        skillName: agentSkillFiles.skillName,
        path: agentSkillFiles.path,
      })
      .from(agentSkillFiles)
      .where(eq(agentSkillFiles.agentId, agentId)),
  ])
  const counts = new Map<string, number>()
  for (const f of files as Pick<AgentSkillFile, 'skillName' | 'path'>[]) {
    counts.set(f.skillName, (counts.get(f.skillName) ?? 0) + 1)
  }
  return skills.map((s) => ({ ...s, fileCount: counts.get(s.name) ?? 0 }))
}

export async function getCachedAgentSkillSummaries(
  agentId: string
): Promise<AgentSkillSummary[]> {
  'use cache'

  cacheLife('minutes')
  cacheTag(agentSkillsTag(agentId))
  return await getAgentSkillSummaries(agentId)
}
