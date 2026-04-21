import { cache } from "react"
import { desc, eq, and } from "drizzle-orm"
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

export async function getLatestRun(): Promise<Run | null> {
  const [row] = await db.select().from(runs).orderBy(desc(runs.startedAt)).limit(1)
  return row ?? null
}

export async function getAllRuns(): Promise<Run[]> {
  return db.select().from(runs).orderBy(desc(runs.startedAt)).limit(100)
}

export async function getRunById(runId: string): Promise<Run | null> {
  const [row] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1)
  return row ?? null
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

export async function getAgentsForUser(userId: string): Promise<Agent[]> {
  return db
    .select()
    .from(agent)
    .where(eq(agent.userId, userId))
    .orderBy(desc(agent.createdAt))
}

/**
 * Wrapped in `React.cache` so the agent row is fetched exactly once per
 * request even when multiple Server Components in the `/agents/[agentId]`
 * subtree (layout + page) read it.
 */
export const getAgentByIdForUser = cache(async function getAgentByIdForUser(
  agentId: string,
  userId: string,
): Promise<Agent | null> {
  const [row] = await db
    .select()
    .from(agent)
    .where(and(eq(agent.id, agentId), eq(agent.userId, userId)))
    .limit(1)
  return row ?? null
})

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

export async function getRunsForAgent(agentId: string, limit = 50): Promise<Run[]> {
  return db
    .select()
    .from(runs)
    .where(eq(runs.agentId, agentId))
    .orderBy(desc(runs.startedAt))
    .limit(limit)
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

/**
 * Return the tz we should interpret schedules in. Defaults to UTC.
 */
export async function getUserTimezone(userId: string): Promise<string> {
  const row = await getUserSettings(userId)
  return row?.timezone ?? "UTC"
}
