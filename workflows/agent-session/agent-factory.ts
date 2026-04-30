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
 * files, memory + exec tools + maintainer tools (Phase 3), and a `pending`
 * buffer the caller must flush via `endOfEvent`.
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

  // Resolve attached maintainer tools first so we know which need
  // reconnection — those reasons get rendered into the system prompt
  // so the model can recover gracefully.
  //
  // Two-stage boot keeps the workflow bundle free of `node:crypto`:
  // (1) the step does DB + decrypt + refresh and returns plain JSON;
  // (2) the workflow synchronously calls `tool.build()` on the result.
  const plan = await resolveToolPlan({ agentId, userId: row.userId })
  const attached = buildAttachedTools({ agentId, plan })

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
    'Follow your operational directives from AGENTS.md and your persona',
    'from SOUL.md. Perform one small, useful heartbeat-sized action,',
    'update memory as your directives require, append a brief bullet to',
    "today's log, then stop.",
  ].join('\n')
}
