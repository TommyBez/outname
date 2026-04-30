'use server'

import { and, eq } from 'drizzle-orm'
import { requireUserId } from '@/lib/auth-guard'
import { db } from '@/lib/db'
import { agent, agentTools, toolSandboxBuilds } from '@/lib/db/schema'

/**
 * Phase 4: terminal-state fallback for the catalog UI.
 *
 * The build workflow's stream is the source of truth for in-flight
 * progress messages — but the run record expires after some time and
 * the stream is no longer fetchable, while the user may still want to
 * know whether the build ultimately succeeded or failed. This action
 * fills that gap.
 *
 * Returns null for unauthorized callers (rather than throwing) so the
 * client UI can degrade gracefully.
 */
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

  // Same owner gate as the stream route — only callers who have
  // actually attached a tool with this manifest see the status.
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
