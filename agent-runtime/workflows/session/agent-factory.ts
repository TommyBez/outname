import { DurableAgent } from '@workflow/ai/agent'
import type { Tool } from 'ai'
import { getAgentById } from '@/agent-runtime/server/start-agent-run'
import { buildAttachedTools } from '@/tools/runtime/build-attached-tools'
import { composeSystemPrompt } from './compose-system-prompt'
import { resolveToolPlan } from './steps/resolve-tool-plan'
import { createFileTools } from './tools/file-tools'
import { createPendingWrites, type PendingWrites } from './tools/pending-writes'

// Build one event-scoped agent: prompt from sandbox files, built-in file
// tools, attached maintainer/sub-agent tools, and a tracker for reviewable
// file writes.
export interface BuildAgentArgs {
  agentId: string
  callStack?: string[]
  conversationId?: string | null
  currentRunId?: string | null
  depth?: number
  nowIso?: string
  runId: string
  streamNamespace?: string | null
}

export interface BuildAgentResult {
  agent: DurableAgent
  meta: {
    name: string
    model: string
    userId: string
    stepLimitCustom: number | null
    stepLimitMode: 'custom' | 'grind' | 'high' | 'low' | 'medium'
  }
  pending: PendingWrites
  tools: Record<string, Tool>
}

export async function buildAgent(
  args: BuildAgentArgs
): Promise<BuildAgentResult> {
  const { agentId, runId } = args
  const callStack = args.callStack ?? []
  const depth = args.depth ?? 0

  const row = await getAgentById(agentId)
  if (!row) {
    throw new Error(`buildAgent: agent ${agentId} not found (run ${runId})`)
  }

  // Resolve reconnects before composing the prompt, and keep DB/decrypt work in
  // `resolveToolPlan` so this workflow bundle stays free of `node:crypto`.
  const plan = await resolveToolPlan({
    agentId,
    userId: row.userId,
    callStack,
    depth,
  })
  const attached = buildAttachedTools({
    agentId,
    userId: row.userId,
    plan,
    callStack,
    currentRunId: args.currentRunId,
    conversationId: args.conversationId,
    depth,
    streamNamespace: args.streamNamespace,
  })

  const systemPrompt = await composeSystemPrompt({
    agentId,
    agentName: row.name,
    nowIso: args.nowIso ?? new Date().toISOString(),
    reconnects: attached.reconnects,
  })

  const pending = createPendingWrites()

  const fileTools = await createFileTools({ agentId, pending })
  const tools = {
    ...fileTools,
    ...attached.tools,
  }

  const durableAgent = new DurableAgent({
    model: row.model,
    system: systemPrompt,
    tools,
  })

  return {
    agent: durableAgent,
    pending,
    tools,
    meta: {
      name: row.name,
      model: row.model,
      userId: row.userId,
      stepLimitCustom: row.stepLimitCustom,
      stepLimitMode: row.stepLimitMode as
        | 'custom'
        | 'grind'
        | 'high'
        | 'low'
        | 'medium',
    },
  }
}

// Generic heartbeat kickoff: AGENTS.md / IDENTITY.md / SOUL.md decide the
// concrete action for this agent.
export function buildHeartbeatKickoff(args: {
  nowIso: string
  previousIso: string | null
}): string {
  const sinceClause = args.previousIso
    ? `Your last heartbeat completed at ${args.previousIso}.`
    : 'This is your first heartbeat — there is no prior run to compare against.'
  return [
    `It is now ${args.nowIso}. This is your scheduled heartbeat.`,
    sinceClause,
    '',
    'Follow your operational directives from AGENTS.md, your identity',
    'card from IDENTITY.md, and your deeper persona from SOUL.md.',
    'Perform one small, useful heartbeat-sized action,',
    'update sandbox files as your directives require, append a brief bullet to',
    "today's log, then stop.",
  ].join('\n')
}

export function buildDreamingKickoff(args: {
  localDate: string
  manual: boolean
  nowIso: string
  previousIso: string | null
}): string {
  const trigger = args.manual
    ? 'The user explicitly requested this dreaming pass.'
    : 'This is your scheduled dreaming pass.'
  const previous = args.previousIso
    ? `Your last completed dream was at ${args.previousIso}.`
    : 'This is your first completed dreaming window.'

  return [
    `It is now ${args.nowIso}. Local date: ${args.localDate}.`,
    trigger,
    previous,
    '',
    'Run a focused DREAMS / dreaming pass:',
    '',
    '1. Use listFiles/grepFiles to inspect recent logs under logs/.',
    '   Prefer today and recent days, but do not read huge files blindly.',
    '2. Read DREAMS.md, GOALS.md, and TASKS.md if they exist.',
    '3. Read DREAMS.md, then write back a dated entry. Cite specific evidence using',
    '   sandbox paths and line numbers returned by grepFiles, e.g.',
    '   `logs/2026-04-30.md:12`.',
    '4. Edit GOALS.md and TASKS.md only when the evidence supports a',
    '   concrete change. Avoid speculative churn.',
    "5. Read today's log if it exists, then write it back with one concise dreaming bullet.",
    '',
    'Stop after the dreaming pass. Do not start an open-ended work session.',
  ].join('\n')
}
