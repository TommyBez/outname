import 'server-only'
import { and, desc, eq } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'
import {
  agentRunsTag,
  agentTag,
  agentToolsTag,
  runsIndexTag,
  runTag,
  userAgentsTag,
  userConnectionsTag,
} from '@/lib/cache-tags'
import { db } from '@/lib/db'
import {
  type Agent,
  type AgentTool,
  agent,
  agentTools,
  type Run,
  type RunResult,
  runResult,
  runs,
  type UserConnection,
  userConnections,
} from '@/lib/db/schema'

export async function getLatestRun(): Promise<Run | null> {
  const [row] = await db
    .select()
    .from(runs)
    .orderBy(desc(runs.startedAt))
    .limit(1)
  return row ?? null
}

export async function getAllRuns(limit = 100): Promise<Run[]> {
  return await db.select().from(runs).orderBy(desc(runs.startedAt)).limit(limit)
}

export async function getCachedAllRuns(limit = 100): Promise<Run[]> {
  'use cache'

  cacheLife('minutes')
  cacheTag(runsIndexTag())
  return await getAllRuns(limit)
}

export async function getRunById(runId: string): Promise<Run | null> {
  const [row] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1)
  return row ?? null
}

export async function getCachedRunById(runId: string): Promise<Run | null> {
  'use cache'

  cacheLife('minutes')
  cacheTag(runTag(runId))
  return await getRunById(runId)
}

/**
 * Fetch the single agent-agnostic text result attached to a run, if any.
 * The row is keyed by `run_id` (PK), so there is at most one per run.
 */
export async function getRunResult(runId: string): Promise<RunResult | null> {
  const [row] = await db
    .select()
    .from(runResult)
    .where(eq(runResult.runId, runId))
    .limit(1)
  return row ?? null
}

export async function getCachedRunResult(
  runId: string
): Promise<RunResult | null> {
  'use cache'

  cacheLife('hours')
  cacheTag(runTag(runId))
  return await getRunResult(runId)
}

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

export async function getLatestRunForAgent(
  agentId: string
): Promise<Run | null> {
  const [row] = await db
    .select()
    .from(runs)
    .where(eq(runs.agentId, agentId))
    .orderBy(desc(runs.startedAt))
    .limit(1)
  return row ?? null
}

export async function getCachedLatestRunForAgent(
  agentId: string
): Promise<Run | null> {
  'use cache'

  cacheLife('minutes')
  cacheTag(agentRunsTag(agentId))
  return await getLatestRunForAgent(agentId)
}

export async function getRunsForAgent(
  agentId: string,
  limit = 50
): Promise<Run[]> {
  return await db
    .select()
    .from(runs)
    .where(eq(runs.agentId, agentId))
    .orderBy(desc(runs.startedAt))
    .limit(limit)
}

export async function getCachedRunsForAgent(
  agentId: string,
  limit = 50
): Promise<Run[]> {
  'use cache'

  cacheLife('minutes')
  cacheTag(agentRunsTag(agentId))
  return await getRunsForAgent(agentId, limit)
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
