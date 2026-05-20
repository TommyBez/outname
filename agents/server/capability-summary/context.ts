import 'server-only'

import { eq } from 'drizzle-orm'
import {
  buildAgentsMdContent,
  extractAgentsMdCustomInstructions,
} from '@/agents/server/agents-md-template'
import { db } from '@/shared/db'
import { agent, agentTools } from '@/shared/db/schema'
import { getAgentMemoryFile } from '@/shared/server/data'
import { providerBackedCapabilities } from '@/tools/catalog/capabilities'
import { getMaintainerTool } from '@/tools/catalog/registry'
import type { MaintainerTool } from '@/tools/catalog/types'
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
        attached.push(describeMaintainerCapability(tool))
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

function describeMaintainerCapability(
  tool: MaintainerTool
): AttachedCapability {
  const providerNote = providerConnectionNote(tool)
  const repoWorkspace = tool.capabilities.find(
    (capability) => capability.kind === 'repo_workspace'
  )
  if (!repoWorkspace) {
    return {
      name: tool.displayName,
      description: appendCapabilityNotes(tool.description, providerNote),
    }
  }

  return {
    name: tool.displayName,
    description: appendCapabilityNotes(
      tool.description,
      providerNote,
      'Creates a live repository workspace at execute time; it is not snapshot-backed. GitHub HTTPS auth is brokered by the sandbox network policy when writable, so no token, username, password, or credential env var is available or needed inside the workspace.'
    ),
  }
}

function providerConnectionNote(tool: MaintainerTool): string | null {
  const providers = providerBackedCapabilities(tool.capabilities).map(
    (capability) => capability.provider
  )
  if (providers.length === 0) {
    return null
  }

  return `Uses ${formatProviderList(providers)} connection${providers.length === 1 ? '' : 's'}; credentials are brokered and are not available as tool input or environment variables.`
}

function appendCapabilityNotes(
  description: string,
  ...notes: Array<string | null>
): string {
  return [description, ...notes.filter((note): note is string => Boolean(note))]
    .join(' ')
    .trim()
}

function formatProviderList(providers: string[]): string {
  const unique = Array.from(new Set(providers))
  if (unique.length === 1) {
    return `the ${unique[0]}`
  }
  if (unique.length === 2) {
    return `the ${unique[0]} and ${unique[1]}`
  }
  return `the ${unique.slice(0, -1).join(', ')}, and ${unique.at(-1)}`
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
