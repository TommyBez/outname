import 'server-only'

import { eq } from 'drizzle-orm'
import { revalidateTag } from 'next/cache'
import { refreshAgentCapabilitySummary } from '@/agents/server/capability-summary'
import { db } from '@/shared/db/pool'
import { agent, agentTools } from '@/shared/db/schema'
import { agentToolsTag } from '@/shared/server/cache-tags'
import {
  childAgentIdFromSubAgentRow,
  uniqueSubAgentToolId,
} from '@/tools/sub-agents/sub-agent-tool-name'
import {
  assertAgentOwnership,
  ownershipError,
  revalidateAgentToolSurfaces,
} from './shared'
import type { AttachOptions, AttachResult } from './types'

export async function attachSubAgentForUser(
  input: {
    childAgentId: string
    parentAgentId: string
    userId: string
  } & AttachOptions
): Promise<AttachResult> {
  const shouldRefresh = input.refreshSummary ?? true
  const shouldRevalidate = input.revalidate ?? true

  try {
    await assertAgentOwnership(input.parentAgentId, input.userId)
  } catch (err) {
    return { ok: false, error: ownershipError(err) }
  }

  if (input.parentAgentId === input.childAgentId) {
    return { ok: false, error: 'An agent cannot delegate to itself.' }
  }

  const child = await loadChildAgent(input.childAgentId)
  if (!child || child.userId !== input.userId) {
    return { ok: false, error: 'Sub-agent not found.' }
  }

  const rows = await db
    .select({
      config: agentTools.config,
      kind: agentTools.kind,
      toolId: agentTools.toolId,
    })
    .from(agentTools)
    .where(eq(agentTools.agentId, input.parentAgentId))

  const existingSubAgent = rows.find(
    (row) =>
      row.kind === 'sub_agent' &&
      childAgentIdFromSubAgentRow({
        config: row.config,
        toolId: row.toolId,
      }) === input.childAgentId
  )
  if (existingSubAgent) {
    await refreshAndRevalidateExisting({
      parentAgentId: input.parentAgentId,
      shouldRefresh,
      shouldRevalidate,
      userId: input.userId,
    })
    return { ok: true }
  }

  const usedToolIds = new Set(rows.map((row) => row.toolId))
  const toolId = uniqueSubAgentToolId({
    childAgentId: input.childAgentId,
    childName: child.name,
    usedToolIds,
  })
  await upsertSubAgentTool({
    childAgentId: input.childAgentId,
    parentAgentId: input.parentAgentId,
    toolId,
  })

  if (shouldRefresh) {
    await refreshAgentCapabilitySummary({ agentId: input.parentAgentId })
  }
  if (shouldRevalidate) {
    revalidateAgentToolSurfaces(input.parentAgentId, input.userId)
  }
  return { ok: true }
}

async function loadChildAgent(childAgentId: string) {
  const [child] = await db
    .select({ userId: agent.userId, enabled: agent.enabled, name: agent.name })
    .from(agent)
    .where(eq(agent.id, childAgentId))
    .limit(1)
  return child
}

async function refreshAndRevalidateExisting(input: {
  parentAgentId: string
  shouldRefresh: boolean
  shouldRevalidate: boolean
  userId: string
}): Promise<void> {
  if (input.shouldRefresh) {
    await refreshAgentCapabilitySummary({ agentId: input.parentAgentId })
  }
  if (!input.shouldRevalidate) {
    return
  }
  if (input.shouldRefresh) {
    revalidateAgentToolSurfaces(input.parentAgentId, input.userId)
  } else {
    revalidateTag(agentToolsTag(input.parentAgentId), 'max')
  }
}

async function upsertSubAgentTool(input: {
  childAgentId: string
  parentAgentId: string
  toolId: string
}): Promise<void> {
  await db
    .insert(agentTools)
    .values({
      agentId: input.parentAgentId,
      toolId: input.toolId,
      kind: 'sub_agent',
      config: { childAgentId: input.childAgentId },
      status: 'connected',
      toolSandboxManifest: null,
      toolSandboxManifestHash: null,
    })
    .onConflictDoUpdate({
      target: [agentTools.agentId, agentTools.kind, agentTools.toolId],
      set: {
        config: { childAgentId: input.childAgentId },
        kind: 'sub_agent',
        status: 'connected',
        toolSandboxManifest: null,
        toolSandboxManifestHash: null,
        updatedAt: new Date(),
      },
    })
}
