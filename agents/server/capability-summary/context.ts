import 'server-only'

import { eq } from 'drizzle-orm'
import {
  buildAgentsMdContent,
  extractAgentsMdCustomInstructions,
} from '@/agents/server/agents-md-template'
import { db } from '@/shared/db'
import { agent, agentTools } from '@/shared/db/schema'
import { getAgentMemoryFile } from '@/shared/server/data'
import { getMaintainerTool } from '@/tools/catalog/registry'
import { childAgentIdFromSubAgentRow } from '@/tools/sub-agents/sub-agent-tool-name'
import type {
  AttachedCapability,
  BootstrapContent,
  SummaryContext,
} from './types'
import { SUMMARY_BOOTSTRAP_PATH } from './types'

export async function loadSummaryContext(input: {
  agentId: string
  bootstrap?: BootstrapContent
}): Promise<SummaryContext | null> {
  const [row] = await db
    .select({
      capabilitySummary: agent.capabilitySummary,
      name: agent.name,
      userId: agent.userId,
    })
    .from(agent)
    .where(eq(agent.id, input.agentId))
    .limit(1)
  if (!row) {
    return null
  }

  const [agentsMd, attached] = await Promise.all([
    loadAgentsMdContent(input.agentId, input.bootstrap),
    loadAttachedCapabilities(input.agentId),
  ])

  return {
    agentsMd,
    attached,
    name: row.name,
    previousSummary: row.capabilitySummary,
    userId: row.userId,
  }
}

async function loadAgentsMdContent(
  agentId: string,
  overrides?: BootstrapContent
): Promise<string> {
  if (overrides && SUMMARY_BOOTSTRAP_PATH in overrides) {
    return buildEffectiveAgentsMd(overrides[SUMMARY_BOOTSTRAP_PATH])
  }
  return await readStoredAgentsMdContent(agentId)
}

async function readStoredAgentsMdContent(agentId: string): Promise<string> {
  const file = await getAgentMemoryFile({
    agentId,
    path: SUMMARY_BOOTSTRAP_PATH,
  })
  return file?.content
    ? buildEffectiveAgentsMd(extractAgentsMdCustomInstructions(file.content))
    : ''
}

function buildEffectiveAgentsMd(
  customInstructions: string | null | undefined
): string {
  return buildAgentsMdContent({ customInstructions })
}

async function loadAttachedCapabilities(
  agentId: string
): Promise<AttachedCapability[]> {
  const rows = await db
    .select({
      config: agentTools.config,
      kind: agentTools.kind,
      toolId: agentTools.toolId,
    })
    .from(agentTools)
    .where(eq(agentTools.agentId, agentId))

  const attached: AttachedCapability[] = []
  const subAgentIds: string[] = []
  for (const row of rows) {
    if (row.kind === 'maintainer') {
      const tool = getMaintainerTool(row.toolId)
      if (tool) {
        attached.push({
          name: tool.displayName,
          description: tool.description,
        })
      }
      continue
    }

    const childAgentId = childAgentIdFromSubAgentRow({
      config: row.config,
      toolId: row.toolId,
    })
    if (childAgentId) {
      subAgentIds.push(childAgentId)
    }
  }

  for (const subAgent of await loadSubAgentCapabilities(subAgentIds)) {
    attached.push(subAgent)
  }
  return attached
}

async function loadSubAgentCapabilities(
  ids: string[]
): Promise<AttachedCapability[]> {
  const uniqueIds = Array.from(new Set(ids))
  if (uniqueIds.length === 0) {
    return []
  }

  const rows = await Promise.all(
    uniqueIds.map(async (id) => {
      const [row] = await db
        .select({
          capabilitySummary: agent.capabilitySummary,
          name: agent.name,
        })
        .from(agent)
        .where(eq(agent.id, id))
        .limit(1)
      return row ?? null
    })
  )

  const attached: AttachedCapability[] = []
  for (const row of rows) {
    if (!row) {
      continue
    }
    attached.push({
      name: `Sub-agent: ${row.name}`,
      description:
        row.capabilitySummary ?? `Delegate work to the ${row.name} sub-agent.`,
    })
  }
  return attached
}
