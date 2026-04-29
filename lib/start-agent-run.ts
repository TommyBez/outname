import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { type Agent, agent } from '@/lib/db/schema'

/**
 * Owner-scoped agent lookup. Kept in this module (rather than co-located
 * with the bulk DB helpers in `lib/data.ts`) because callers historically
 * imported it from here alongside `startAgentRun`. The `startAgentRun`
 * dispatcher itself was removed in the agent-session refactor — runs are
 * now driven by the unified `agentSession` workflow whose lifecycle is
 * managed in `lib/agent-session.ts`.
 */
export async function getAgentById(agentId: string): Promise<Agent | null> {
  const [row] = await db
    .select()
    .from(agent)
    .where(eq(agent.id, agentId))
    .limit(1)
  return row ?? null
}
