'use server'

import { and, eq } from 'drizzle-orm'
import { revalidateTag } from 'next/cache'
import { requireUserId } from '@/lib/auth-guard'
import { agentToolsTag } from '@/lib/cache-tags'
import { db } from '@/lib/db'
import { agent, agentTools } from '@/lib/db/schema'
import { ensureToolSandboxBuild } from '@/lib/tool-sandbox-build'
import { AGENT_TOOL_PREFIX } from '@/tools/agent-tool'
import { getMaintainerTool } from '@/tools/registry'

interface AttachResult {
  error?: string
  ok: boolean
  /**
   * Phase 4: when the tool depends on a tool-sandbox snapshot that
   * has to be (re)built, the action returns the build id so the UI
   * can subscribe to its progress stream. `undefined` for tools that
   * are immediately usable.
   */
  pendingBuildId?: string
}

async function assertAgentOwnership(agentId: string, userId: string) {
  const [row] = await db
    .select({ userId: agent.userId })
    .from(agent)
    .where(eq(agent.id, agentId))
    .limit(1)

  if (!row) {
    throw new Error('Agent not found.')
  }
  if (row.userId !== userId) {
    throw new Error('Forbidden.')
  }
}

export async function attachToolAction(
  agentId: string,
  toolId: string,
  rawConfig: Record<string, unknown>
): Promise<AttachResult> {
  // Phase 4: a tool id starting with `agent_` is a sub-agent
  // attachment, not a maintainer-tool attachment. Route it through
  // the dedicated helper so the form layer can stay agnostic.
  if (toolId.startsWith(AGENT_TOOL_PREFIX)) {
    return attachSubAgentAction(agentId, toolId.slice(AGENT_TOOL_PREFIX.length))
  }

  const userId = await requireUserId()
  try {
    await assertAgentOwnership(agentId, userId)
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Forbidden.',
    }
  }

  const tool = getMaintainerTool(toolId)
  if (!tool) {
    return { ok: false, error: 'Unknown tool.' }
  }

  const schema = tool.configSchema
  const parsed = schema
    ? schema.safeParse(rawConfig)
    : ({ success: true as const, data: {} as Record<string, unknown> } as const)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid configuration.',
    }
  }

  // Phase 4: tools may declare a `tool_sandbox` requirement. We must
  // either confirm a ready snapshot or kick off a build before the
  // attach is "complete enough" for the model to see it. The row is
  // inserted in `pending` state when a build is in flight; the build
  // workflow flips it to `connected` on success.
  const sandboxManifest =
    tool.requirements.find((r) => r.kind === 'tool_sandbox')?.manifest ?? null

  let pendingBuildId: string | undefined
  let rowStatus: 'connected' | 'pending' = 'connected'
  if (sandboxManifest) {
    try {
      const result = await ensureToolSandboxBuild({
        manifestId: sandboxManifest,
      })
      if (result.state === 'building') {
        rowStatus = 'pending'
        pendingBuildId = result.buildId
      }
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to start build.',
      }
    }
  }

  await db
    .insert(agentTools)
    .values({
      agentId,
      toolId,
      config: parsed.data ?? {},
      status: rowStatus,
      toolSandboxManifest: sandboxManifest,
      toolSandboxError: null,
    })
    .onConflictDoUpdate({
      target: [agentTools.agentId, agentTools.toolId],
      set: {
        config: parsed.data ?? {},
        status: rowStatus,
        toolSandboxManifest: sandboxManifest,
        // Don't clear an existing error here — markBuildReady /
        // markBuildFailed own that field. Re-attaching with the same
        // hash is a no-op for the build worker.
        updatedAt: new Date(),
      },
    })

  revalidateTag(agentToolsTag(agentId), 'max')
  return { ok: true, pendingBuildId }
}

/**
 * Phase 4: attach one of the user's other agents as a sub-agent.
 *
 * The model sees this as an `agent_<childId>` tool. We:
 *
 *   - Refuse to attach an agent to itself (cycle of length 0).
 *   - Refuse if the parent and child are owned by different users.
 *   - Don't validate cycles deeper than self-attach here; longer
 *     cycles are caught at run time by `resolveToolPlan` and never
 *     reach the LLM.
 *
 * No tool-sandbox build needed — sub-agents are pure DB rows.
 */
export async function attachSubAgentAction(
  parentAgentId: string,
  childAgentId: string
): Promise<AttachResult> {
  const userId = await requireUserId()
  try {
    await assertAgentOwnership(parentAgentId, userId)
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Forbidden.',
    }
  }

  if (parentAgentId === childAgentId) {
    return {
      ok: false,
      error: 'An agent cannot delegate to itself.',
    }
  }

  // Verify the child belongs to the same user. We don't reveal a
  // not-found vs not-yours distinction.
  const [child] = await db
    .select({ userId: agent.userId, enabled: agent.enabled })
    .from(agent)
    .where(eq(agent.id, childAgentId))
    .limit(1)
  if (!child || child.userId !== userId) {
    return { ok: false, error: 'Sub-agent not found.' }
  }

  const toolId = `${AGENT_TOOL_PREFIX}${childAgentId}`
  await db
    .insert(agentTools)
    .values({
      agentId: parentAgentId,
      toolId,
      config: {},
      status: 'connected',
      toolSandboxManifest: null,
    })
    .onConflictDoUpdate({
      target: [agentTools.agentId, agentTools.toolId],
      set: {
        status: 'connected',
        updatedAt: new Date(),
      },
    })

  revalidateTag(agentToolsTag(parentAgentId), 'max')
  return { ok: true }
}

export async function detachToolAction(
  agentId: string,
  toolId: string
): Promise<AttachResult> {
  const userId = await requireUserId()
  try {
    await assertAgentOwnership(agentId, userId)
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Forbidden.',
    }
  }

  await db
    .delete(agentTools)
    .where(and(eq(agentTools.agentId, agentId), eq(agentTools.toolId, toolId)))

  revalidateTag(agentToolsTag(agentId), 'max')
  return { ok: true }
}
