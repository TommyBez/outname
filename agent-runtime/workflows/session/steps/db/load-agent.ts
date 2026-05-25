import { eq } from 'drizzle-orm'
import type { Agent } from '@/shared/db/schema'
import { agent } from '@/shared/db/schema'
import { getDb } from './get-db'

export async function loadAgentStep(input: {
  agentId: string
}): Promise<Agent | null> {
  'use step'
  const db = await getDb()
  const [row] = await db
    .select()
    .from(agent)
    .where(eq(agent.id, input.agentId))
    .limit(1)
  return row ?? null
}
