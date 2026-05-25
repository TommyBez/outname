import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { type Agent, agent } from '@/shared/db/schema'

export async function getAgentById(agentId: string): Promise<Agent | null> {
  const [row] = await db
    .select()
    .from(agent)
    .where(eq(agent.id, agentId))
    .limit(1)
  return row ?? null
}
