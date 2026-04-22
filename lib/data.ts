import "server-only"
import { desc, eq, and } from "drizzle-orm"
import { cacheLife, cacheTag } from "next/cache"
import { db } from "@/lib/db"
import {
  runs,
  digests,
  digestItems,
  agent,
  userSettings,
  type Run,
  type Digest,
  type DigestItem,
  type Agent,
  type UserSettings,
} from "@/lib/db/schema"
import {
  agentRunsTag,
  agentTag,
  runTag,
  runsIndexTag,
  userAgentsTag,
  userSettingsTag,
} from "@/lib/cache-tags"

export async function getLatestRun(): Promise<Run | null> {
  const [row] = await db.select().from(runs).orderBy(desc(runs.startedAt)).limit(1)
  return row ?? null
}

export async function getAllRuns(limit = 100): Promise<Run[]> {
  return db.select().from(runs).orderBy(desc(runs.startedAt)).limit(limit)
}

export async function getCachedAllRuns(limit = 100): Promise<Run[]> {
  "use cache"

  cacheLife("minutes")
  cacheTag(runsIndexTag())
  return getAllRuns(limit)
}

export async function getRunById(runId: string): Promise<Run | null> {
  const [row] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1)
  return row ?? null
}

export async function getCachedRunById(runId: string): Promise<Run | null> {
  "use cache"

  cacheLife("minutes")
  cacheTag(runTag(runId))
  return getRunById(runId)
}

export async function getDigestForRun(runId: string): Promise<Digest | null> {
  const [row] = await db.select().from(digests).where(eq(digests.runId, runId)).limit(1)
  return row ?? null
}

export async function getDigestItems(digestId: string): Promise<DigestItem[]> {
  return db.select().from(digestItems).where(eq(digestItems.digestId, digestId))
}

export async function getDigestWithItems(runId: string) {
  const digest = await getDigestForRun(runId)
  if (!digest) return { digest: null, items: [] }
  const items = await getDigestItems(digest.id)
  return { digest, items }
}

export async function getCachedDigestWithItems(runId: string) {
  "use cache"

  cacheLife("hours")
  cacheTag(runTag(runId))
  return getDigestWithItems(runId)
}

export async function getAgentsForUser(userId: string): Promise<Agent[]> {
  return db
    .select()
    .from(agent)
    .where(eq(agent.userId, userId))
    .orderBy(desc(agent.createdAt))
}

export async function getCachedAgentsForUser(userId: string): Promise<Agent[]> {
  "use cache"

  cacheLife("minutes")
  cacheTag(userAgentsTag(userId))
  return getAgentsForUser(userId)
}

/**
 * Owner-scoped row lookup used by route handlers and other request-time
 * paths that should bypass the cross-request cache.
 */
export async function getAgentByIdForUser(
  agentId: string,
  userId: string,
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
  userId: string,
): Promise<Agent | null> {
  "use cache"

  cacheLife("minutes")
  cacheTag(userAgentsTag(userId), agentTag(agentId))
  return getAgentByIdForUser(agentId, userId)
}

export async function getLatestRunForAgent(
  agentId: string,
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
  agentId: string,
): Promise<Run | null> {
  "use cache"

  cacheLife("minutes")
  cacheTag(agentRunsTag(agentId))
  return getLatestRunForAgent(agentId)
}

export async function getRunsForAgent(agentId: string, limit = 50): Promise<Run[]> {
  return db
    .select()
    .from(runs)
    .where(eq(runs.agentId, agentId))
    .orderBy(desc(runs.startedAt))
    .limit(limit)
}

export async function getCachedRunsForAgent(
  agentId: string,
  limit = 50,
): Promise<Run[]> {
  "use cache"

  cacheLife("minutes")
  cacheTag(agentRunsTag(agentId))
  return getRunsForAgent(agentId, limit)
}

export async function getUserSettings(
  userId: string,
): Promise<UserSettings | null> {
  const [row] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1)
  return row ?? null
}

export async function getCachedUserSettings(
  userId: string,
): Promise<UserSettings | null> {
  "use cache"

  cacheLife("minutes")
  cacheTag(userSettingsTag(userId))
  return getUserSettings(userId)
}

/**
 * Return the tz we should interpret schedules in. Defaults to UTC.
 */
export async function getUserTimezone(userId: string): Promise<string> {
  const row = await getUserSettings(userId)
  return row?.timezone ?? "UTC"
}

export async function getCachedUserTimezone(userId: string): Promise<string> {
  "use cache"

  cacheLife("minutes")
  cacheTag(userSettingsTag(userId))
  return getUserTimezone(userId)
}
