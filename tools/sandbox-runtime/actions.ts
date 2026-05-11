'use server'

import { and, eq } from 'drizzle-orm'
import { requireUserId } from '@/auth/server/auth-guard'
import { db } from '@/shared/db'
import { agent, agentTools, toolSandboxBuilds } from '@/shared/db/schema'

// Fallback for when the workflow stream is gone: return only terminal build
// state, not historical progress. Unauthorized callers get `null`/`forbidden`
// so the client can degrade gracefully.
export async function getToolSandboxBuildStatusAction(buildId: string): Promise<
  | {
      status: 'pending' | 'running' | 'ready' | 'failed'
      errorText: string | null
    }
  | { status: 'forbidden' }
  | null
> {
  const userId = await requireUserId()

  const [build] = await db
    .select({
      status: toolSandboxBuilds.status,
      errorText: toolSandboxBuilds.errorText,
      manifestId: toolSandboxBuilds.manifestId,
    })
    .from(toolSandboxBuilds)
    .where(eq(toolSandboxBuilds.id, buildId))
    .limit(1)
  if (!build) {
    return null
  }

  // Match the stream route's owner gate.
  const [ownerRow] = await db
    .select({ agentId: agentTools.agentId })
    .from(agentTools)
    .innerJoin(agent, eq(agent.id, agentTools.agentId))
    .where(
      and(
        eq(agentTools.toolSandboxManifest, build.manifestId),
        eq(agent.userId, userId)
      )
    )
    .limit(1)
  if (!ownerRow) {
    return { status: 'forbidden' }
  }

  return { status: build.status, errorText: build.errorText }
}
