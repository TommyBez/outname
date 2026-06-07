import 'server-only'
import { db } from '@outname/db'
import { user } from '@outname/db/schema'
import { AGENT_CREATION_LIMIT } from '@outname/shared/agents/creation-limits'
import { roleBypassesAgentCreationLimit } from '@outname/shared/agents/server/creation-limit-roles'
import { eq } from 'drizzle-orm'

export async function canCreateAgentForUser(input: {
  agentCount: number
  userId: string
}): Promise<boolean> {
  const [row] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, input.userId))
    .limit(1)

  if (!row) {
    return false
  }

  if (roleBypassesAgentCreationLimit(row.role)) {
    return true
  }
  return input.agentCount < AGENT_CREATION_LIMIT
}
