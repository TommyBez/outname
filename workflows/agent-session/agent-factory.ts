import { DurableAgent } from '@workflow/ai/agent'
import { getAgentById } from '@/lib/start-agent-run'
import { composeSystemPrompt } from './compose-system-prompt'
import { createExecTools } from './tools/exec-tools'
import { createMemoryTools } from './tools/memory-tools'
import { createPendingWrites, type PendingWrites } from './tools/pending-writes'

/**
 * One event's agent: DB load, composed system prompt from sandbox persona
 * files, memory + exec tools, and a `pending` buffer the caller must flush
 * via `endOfEvent`.
 */
export interface BuildAgentArgs {
  agentId: string
  /** Optional UTC "now" for the system prompt; defaults to `new Date()`. */
  nowIso?: string
  /** Heartbeat: `runs.id`; chat: conversation id. */
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

  const row = await getAgentById(agentId)
  if (!row) {
    throw new Error(`buildAgent: agent ${agentId} not found (run ${runId})`)
  }

  const systemPrompt = await composeSystemPrompt({
    agentId,
    agentName: row.name,
    nowIso: args.nowIso ?? new Date().toISOString(),
  })

  const pending = createPendingWrites()

  const memoryTools = createMemoryTools({ agentId, pending })
  const execTools = await createExecTools({ agentId, pending })

  const durableAgent = new DurableAgent({
    model: row.model,
    system: systemPrompt,
    tools: {
      ...memoryTools,
      ...execTools,
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
 * and decides what to do via its own AGENTS.md / SOUL.md.
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
    'Use this time to:',
    "  1. Read your TASKS.md and CALENDAR.md to see what's pending.",
    '  2. Make incremental progress on anything you can finish quickly with',
    '     your available tools.',
    '  3. Update memory files with anything new you learned or decided.',
    "  4. Append one bullet to today's log under logs/<YYYY-MM-DD>.md",
    '     summarising what happened during this heartbeat.',
    '',
    'Be terse. Stop when there is nothing more useful to do — do not',
    "manufacture work. A heartbeat that simply logs 'no changes' is fine.",
  ].join('\n')
}
