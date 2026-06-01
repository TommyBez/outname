import 'server-only'
import { db } from '@outname/db'
import { type Agent, agent } from '@outname/db/schema'
import { eq } from 'drizzle-orm'

export async function getAgentById(agentId: string): Promise<Agent | null> {
  const [row] = await db
    .select()
    .from(agent)
    .where(eq(agent.id, agentId))
    .limit(1)
  return row ?? null
}
