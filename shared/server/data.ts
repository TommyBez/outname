import 'server-only'
import { and, desc, eq } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'
import {
  type AgentMemoryFile,
  listAgentFilesFromSandbox,
  readAgentFileFromSandbox,
  readCachedAgentFile,
  readCachedAgentFiles,
} from '@/agent-runtime/server/file-cache'
import { db } from '@/shared/db'
import {
  type Agent,
  type AgentTool,
  agent,
  agentTools,
  type UserConnection,
  userConnections,
} from '@/shared/db/schema'
import {
  agentTag,
  agentToolsTag,
  userAgentsTag,
  userConnectionsTag,
} from '@/shared/server/cache-tags'

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

export async function getAgentMemoryFiles(
  agentId: string
): Promise<AgentMemoryFile[]> {
  const cached = await readCachedAgentFiles(agentId)
  if (cached.length > 0) {
    return cached.sort((a, b) => a.path.localeCompare(b.path))
  }
  return await listAgentFilesFromSandbox(agentId)
}

export async function getCachedAgentMemoryFiles(
  agentId: string
): Promise<AgentMemoryFile[]> {
  'use cache'

  cacheLife('minutes')
  cacheTag(agentTag(agentId))
  return await getAgentMemoryFiles(agentId)
}

export async function getAgentLogFiles(
  agentId: string
): Promise<AgentMemoryFile[]> {
  const rows = await getAgentMemoryFiles(agentId)
  return rows
    .filter((row) => row.path.startsWith('logs/'))
    .sort((a, b) => b.path.localeCompare(a.path))
}

export async function getCachedAgentLogFiles(
  agentId: string
): Promise<AgentMemoryFile[]> {
  'use cache'

  cacheLife('minutes')
  cacheTag(agentTag(agentId))
  return await getAgentLogFiles(agentId)
}

export async function getAgentMemoryFile(input: {
  agentId: string
  path: string
}): Promise<AgentMemoryFile | null> {
  return (
    (await readCachedAgentFile(input)) ??
    (await readAgentFileFromSandbox(input))
  )
}

export async function getCachedAgentMemoryFile(input: {
  agentId: string
  path: string
}): Promise<AgentMemoryFile | null> {
  'use cache'

  cacheLife('minutes')
  cacheTag(agentTag(input.agentId))
  return await getAgentMemoryFile(input)
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
