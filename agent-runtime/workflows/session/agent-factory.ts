import { DurableAgent } from '@workflow/ai/agent'
import type { Tool } from 'ai'
import {
  type AgentRuntimeMeta,
  type AgentRuntimeSpec,
  buildAgentRuntimeSpec,
  runtimeMetaFromSpec,
} from '@/agent-runtime/server/runtime-spec'
import { getUserModelForGateway } from '@/shared/server/ai-gateway-byok'
import { buildAttachedTools } from '@/tools/runtime/build-attached-tools'
import type { SubAgentProgressTarget } from '@/tools/sub-agents/progress-target'
import {
  noSubAgentProgressTarget,
  workflowParentStreamTarget,
} from '@/tools/sub-agents/progress-target'
import { createFileTools } from './tools/file-tools'

// Build one event-scoped agent: prompt from sandbox files, built-in file tools,
// and attached maintainer/sub-agent tools.
export interface BuildAgentArgs {
  agentId: string
  callStack?: string[]
  conversationId?: string | null
  currentRunId?: string | null
  depth?: number
  eventKind?: 'chat' | 'dreaming' | 'heartbeat' | 'invocation'
  nowIso?: string
  runId: string
  streamNamespace?: string | null
}

export interface BuildAgentResult {
  agent: DurableAgent
  meta: AgentRuntimeMeta
  tools: Record<string, Tool>
}

export async function buildAgent(
  args: BuildAgentArgs
): Promise<BuildAgentResult> {
  const spec = await buildAgentRuntimeSpec({
    agentId: args.agentId,
    callStack: args.callStack,
    depth: args.depth,
    eventKind: args.eventKind ?? 'heartbeat',
    nowIso: args.nowIso,
    runId: args.runId,
  })
  return buildDurableAgentRuntime(spec, {
    conversationId: args.conversationId,
    currentRunId: args.currentRunId,
    progressTarget: workflowParentStreamTarget(args.streamNamespace),
  })
}

export function buildDurableAgentRuntime(
  spec: AgentRuntimeSpec,
  options: {
    conversationId?: string | null
    currentRunId?: string | null
    progressTarget?: SubAgentProgressTarget
  } = {}
): BuildAgentResult {
  const attached = buildAttachedTools({
    agentId: spec.agentId,
    userId: spec.userId,
    plan: spec.toolPlan,
    callStack: spec.callStack,
    currentRunId: options.currentRunId,
    conversationId: options.conversationId,
    depth: spec.depth,
    progressTarget: options.progressTarget ?? noSubAgentProgressTarget,
  })

  const tools = {
    ...createFileTools({ agentId: spec.agentId }),
    ...attached.tools,
  }

  const durableAgent = new DurableAgent({
    model: async () => {
      'use step'
      const model = await getUserModelForGateway({
        modelId: spec.modelId,
        userId: spec.userId,
      })
      return model
    },
    system: spec.systemPrompt,
    tools,
  })

  return {
    agent: durableAgent,
    tools,
    meta: runtimeMetaFromSpec(spec),
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
