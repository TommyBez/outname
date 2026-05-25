import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import type { Agent } from '@/shared/db/schema'
import { agent } from '@/shared/db/schema'

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
