import 'server-only'
import { generateText } from 'ai'
import { and, eq } from 'drizzle-orm'
import { readLatestPendingFileWrite } from '@/lib/agent-pending-writes'
import { buildAgentsMdContent } from '@/lib/agents-md-template'
import { db } from '@/lib/db'
import { agent, agentFiles, agentTools } from '@/lib/db/schema'
import { getMaintainerTool } from '@/tools/registry'
import { childAgentIdFromSubAgentRow } from '@/tools/sub-agent-tool-name'

const SUMMARY_BOOTSTRAP_PATH = 'AGENTS.md'
const SUB_AGENT_NAME_PREFIX = /^Sub-agent:\s*/i

type BootstrapContent = Partial<Record<typeof SUMMARY_BOOTSTRAP_PATH, string>>

interface AttachedCapability {
  description: string
  name: string
}

interface SummaryContext {
  agentsMd: string
  attached: AttachedCapability[]
  name: string
  previousSummary: string | null
}

const SUMMARY_MODEL = 'openai/gpt-5.4-nano'
const SUMMARY_MAX_CHARS = 450
const SUMMARY_TRUNCATION_MIN_RATIO = 0.75
const CONTEXT_MAX_CHARS = 1800
const DISALLOWED_SUMMARY_DETAILS = [
  /\baudit trail\b/i,
  /\bdatabase\b/i,
  /\bfile names?\b/i,
  /\blogs?\b/i,
  /\bmemory\b/i,
  /\bmessage identifiers?\b/i,
  /\bmessage ids?\b/i,
  /\bpersistence\b/i,
  /\bsecrets?\b/i,
  /\btimestamps?\b/i,
  /\bapi keys?\b/i,
]

export async function refreshAgentCapabilitySummary(input: {
  agentId: string
  bootstrap?: BootstrapContent
}): Promise<string | null> {
  try {
    const context = await loadSummaryContext(input)
    if (!context) {
      return null
    }

    const fallback = fallbackSummary(context)
    let summary = fallback

    try {
      const { text } = await generateText({
        model: SUMMARY_MODEL,
        system: [
          'You write model-facing descriptions for AI sub-agents.',
          'Return one short paragraph, 1-2 sentences, maximum 450 characters.',
          'Describe when a parent agent should delegate to this sub-agent.',
          'Mention major attached tools by capability, not raw IDs.',
          'Focus only on the type of work the sub-agent can do and notable external tools.',
          'Omit procedures, validation steps, audit trails, persistence details, file names, message IDs, timestamps, logs, database fields, secrets, and implementation details.',
          'Use plain text only, without Markdown formatting.',
        ].join('\n'),
        prompt: formatSummaryPrompt(context),
      })
      summary = cleanSummary(text) || fallback
    } catch (err) {
      if (context.previousSummary) {
        console.error(
          '[v0] refreshAgentCapabilitySummary: generation failed; keeping previous summary',
          err
        )
        return context.previousSummary
      }
      console.error(
        '[v0] refreshAgentCapabilitySummary: generation failed; using fallback',
        err
      )
    }

    await db
      .update(agent)
      .set({ capabilitySummary: summary })
      .where(eq(agent.id, input.agentId))
    return summary
  } catch (err) {
    console.error('[v0] refreshAgentCapabilitySummary failed', err)
    return null
  }
}

async function loadSummaryContext(input: {
  agentId: string
  bootstrap?: BootstrapContent
}): Promise<SummaryContext | null> {
  const [row] = await db
    .select({
      capabilitySummary: agent.capabilitySummary,
      name: agent.name,
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
  const pending = await readLatestPendingFileWrite({
    agentId,
    path: SUMMARY_BOOTSTRAP_PATH,
  })
  if (pending) {
    return buildEffectiveAgentsMd(pending.content)
  }

  const [file] = await db
    .select({ content: agentFiles.content })
    .from(agentFiles)
    .where(
      and(
        eq(agentFiles.agentId, agentId),
        eq(agentFiles.path, SUMMARY_BOOTSTRAP_PATH)
      )
    )
    .limit(1)
  return file?.content ?? ''
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

function formatSummaryPrompt(context: SummaryContext): string {
  return [
    `Agent being summarized: ${context.name}`,
    `Write about ${context.name}, not about an attached sub-agent.`,
    '',
    `${SUMMARY_BOOTSTRAP_PATH}:`,
    clipText(context.agentsMd) || '(none provided)',
    '',
    'Attached tools and sub-agents:',
    formatAttachedCapabilities(context.attached),
  ].join('\n')
}

function clipText(text: string): string {
  return text.trim().slice(0, CONTEXT_MAX_CHARS)
}

function formatAttachedCapabilities(attached: AttachedCapability[]): string {
  if (attached.length === 0) {
    return '(none)'
  }
  return attached
    .map((item) => `- ${item.name}: ${item.description}`)
    .join('\n')
    .slice(0, CONTEXT_MAX_CHARS)
}

function fallbackSummary(context: SummaryContext): string {
  const toolNames = context.attached
    .map((item) => item.name.replace(SUB_AGENT_NAME_PREFIX, ''))
    .slice(0, 4)
  if (toolNames.length === 0) {
    return `${context.name} is a general-purpose sub-agent for delegated research, planning, and execution.`
  }
  return `${context.name} is a sub-agent for delegated work that can draw on ${toolNames.join(', ')}.`
}

function cleanSummary(text: string): string {
  const cleaned = text
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/[*_~`]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const clipped = truncateSummary(cleaned)
  if (DISALLOWED_SUMMARY_DETAILS.some((pattern) => pattern.test(cleaned))) {
    return ''
  }
  return clipped
}

function truncateSummary(text: string): string {
  if (text.length <= SUMMARY_MAX_CHARS) {
    return text
  }

  const clipped = text.slice(0, SUMMARY_MAX_CHARS).trim()
  const minimumWordBoundary = Math.floor(
    SUMMARY_MAX_CHARS * SUMMARY_TRUNCATION_MIN_RATIO
  )
  const lastSpace = clipped.lastIndexOf(' ')
  const truncated =
    lastSpace >= minimumWordBoundary ? clipped.slice(0, lastSpace) : clipped
  const tidied = truncated.replace(/[,:;\s-]+$/g, '')
  return tidied.endsWith('.') ? tidied : `${tidied}.`
}
