import { db } from '@outname/db'
import type { Agent } from '@outname/db/schema'
import { agent } from '@outname/db/schema'
import { eq } from 'drizzle-orm'

export async function loadAgentStep(input: {
  agentId: string
}): Promise<Agent | null> {
  'use step'
  const [row] = await db
    .select()
    .from(agent)
    .where(eq(agent.id, input.agentId))
    .limit(1)
  return row ?? null
}
