'use server'

import { and, eq } from 'drizzle-orm'
import { revalidateTag } from 'next/cache'
import { requireUserId } from '@/lib/auth-guard'
import { agentToolsTag } from '@/lib/cache-tags'
import { db } from '@/lib/db'
import { agent, agentTools } from '@/lib/db/schema'
import { getMaintainerTool } from '@/tools/registry'

interface AttachResult {
  error?: string
  ok: boolean
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

  await db
    .insert(agentTools)
    .values({
      agentId,
      toolId,
      config: parsed.data ?? {},
    })
    .onConflictDoUpdate({
      target: [agentTools.agentId, agentTools.toolId],
      set: {
        config: parsed.data ?? {},
        updatedAt: new Date(),
      },
    })

  revalidateTag(agentToolsTag(agentId), 'max')
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
