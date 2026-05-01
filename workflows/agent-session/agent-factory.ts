import { DurableAgent } from '@workflow/ai/agent'
import { getAgentById } from '@/lib/start-agent-run'
import { buildAttachedTools } from '@/tools/build-attached-tools'
import { composeSystemPrompt } from './compose-system-prompt'
import { resolveToolPlan } from './steps/resolve-tool-plan'
import { createExecTools } from './tools/exec-tools'
import { createMemoryTools } from './tools/memory-tools'
import { createPendingWrites, type PendingWrites } from './tools/pending-writes'

/**
 * One event's agent: DB load, composed system prompt from sandbox persona
 * files, memory + exec tools + maintainer tools (Phase 3) + sub-agent
 * tools (Phase 4), and a `pending` buffer the caller must flush via
 * `endOfEvent`.
 */
export interface BuildAgentArgs {
  agentId: string
  /**
   * Phase 4: parent agent ids leading to this run. Empty for normal
   * user-driven chat / heartbeat turns. Populated when this turn was
   * dispatched as a sub-agent invocation. resolveToolPlan uses it to
   * refuse cycles, and the synthesised `agent_<child>` tools append
   * their own id before dispatching.
   */
  callStack?: string[]
  /** Workflow runtime id for heartbeat/reflection/invocation events. */
  currentRunId?: string | null
  /**
   * Phase 4: nesting depth. 0 for normal turns, parentDepth + 1 for
   * sub-agent invocations. resolveToolPlan refuses any sub-agent attach that
   * would push depth past `MAX_SUB_AGENT_DEPTH`.
   */
  depth?: number
  /** Optional UTC "now" for the system prompt; defaults to `new Date()`. */
  nowIso?: string
  /** Heartbeat/invocation: workflow runtime id; chat: conversation id. */
  runId: string
}

export interface BuildAgentResult {
  agent: DurableAgent
  /** Name + model from the row (avoid a second read for logging). */
  meta: {
    name: string
    model: string
  }
  /** Per-event memory mutation buffer. Pass to `endOfEvent`. */
  pending: PendingWrites
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

  // Resolve attached maintainer tools first so we know which need
  // reconnection — those reasons get rendered into the system prompt
  // so the model can recover gracefully.
  //
  // Two-stage boot keeps the workflow bundle free of `node:crypto`:
  // (1) the step does DB + decrypt + refresh and returns plain JSON;
  // (2) the workflow synchronously calls `tool.build()` on the result.
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
    depth,
  })

  const systemPrompt = await composeSystemPrompt({
    agentId,
    agentName: row.name,
    nowIso: args.nowIso ?? new Date().toISOString(),
    reconnects: attached.reconnects,
  })

  const pending = createPendingWrites()

  const memoryTools = createMemoryTools({ agentId, pending })
  const execTools = createExecTools({ agentId, pending })

  const durableAgent = new DurableAgent({
    model: row.model,
    system: systemPrompt,
    tools: {
      ...memoryTools,
      ...execTools,
      ...attached.tools,
    },
  })

  return {
    agent: durableAgent,
    pending,
    meta: {
      name: row.name,
      model: row.model,
    },
  }
}

/**
 * Heartbeat kickoff message — the seed user turn that triggers a
 * heartbeat run. Generic by design: every agent gets the same prompt
 * and decides what to do via its own AGENTS.md / IDENTITY.md / SOUL.md.
 */
export function buildHeartbeatKickoff(args: {
  /** ISO timestamp the run began. */
  nowIso: string
  /**
   * ISO timestamp of the previous successful heartbeat completion, if
   * any. Helps the model pick a window to look at.
   */
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
    'update memory as your directives require, append a brief bullet to',
    "today's log, then stop.",
  ].join('\n')
}

export function buildReflectionKickoff(args: {
  localDate: string
  manual: boolean
  nowIso: string
  previousIso: string | null
}): string {
  const trigger = args.manual
    ? 'The user explicitly requested this reflection pass.'
    : 'This is your scheduled reflection pass.'
  const previous = args.previousIso
    ? `Your last completed reflection was at ${args.previousIso}.`
    : 'This is your first completed reflection window.'

  return [
    `It is now ${args.nowIso}. Local date: ${args.localDate}.`,
    trigger,
    previous,
    '',
    'Run a focused DREAMS / reflection pass:',
    '',
    '1. Use list_memory/search_memory to inspect recent logs under logs/.',
    '   Prefer today and recent days, but do not read huge files blindly.',
    '2. Read DREAMS.md, GOALS.md, and TASKS.md if they exist.',
    '3. Append a dated entry to DREAMS.md. Cite specific evidence using',
    '   memory paths and line numbers returned by search_memory, e.g.',
    '   `logs/2026-04-30.md:12`.',
    '4. Edit GOALS.md and TASKS.md only when the evidence supports a',
    '   concrete change. Avoid speculative churn.',
    "5. Append one concise bullet to today's log summarizing the reflection.",
    '',
    'Stop after the reflection. Do not start an open-ended work session.',
  ].join('\n')
}
