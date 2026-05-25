import 'server-only'

import { and, eq } from 'drizzle-orm'
import { refreshAgentCapabilitySummary } from '@/agents/server/capability-summary'
import { db } from '@/shared/db/pool'
import { type AgentToolKind, agentTools } from '@/shared/db/schema'
import {
  assertAgentOwnership,
  ownershipError,
  revalidateAgentToolSurfaces,
} from './shared'
import type { AttachResult } from './types'

export async function detachToolForUser(input: {
  agentId: string
  kind?: AgentToolKind
  toolId: string
  userId: string
}): Promise<AttachResult> {
  try {
    await assertAgentOwnership(input.agentId, input.userId)
  } catch (err) {
    return { ok: false, error: ownershipError(err) }
  }

  await db
    .delete(agentTools)
    .where(
      and(
        eq(agentTools.agentId, input.agentId),
        eq(agentTools.toolId, input.toolId),
        eq(agentTools.kind, input.kind ?? 'maintainer')
      )
    )

  await refreshAgentCapabilitySummary({ agentId: input.agentId })
  revalidateAgentToolSurfaces(input.agentId, input.userId)
  return { ok: true }
}
