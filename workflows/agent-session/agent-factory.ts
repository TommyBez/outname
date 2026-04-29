import { DurableAgent } from "@workflow/ai/agent"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { agent } from "@/lib/db/schema"
import { getSystemSandbox } from "@/lib/agent-sandbox"
import { composeSystemPrompt } from "./compose-system-prompt"
import { createMemoryTools } from "./tools/memory-tools"
import { createExecTools } from "./tools/exec-tools"
import {
  createPendingWrites,
  type PendingWrites,
} from "./tools/pending-writes"

/**
 * Build a DurableAgent for a single event (chat turn or heartbeat).
 *
 * Phase 2 collapses the per-kind agent factory to a single generic
 * builder. Every agent shares the same tool surface — five memory_*
 * tools (closed over the per-event `pending` queue) and four exec_*
 * tools — and receives a freshly-composed system prompt that inlines
 * the live `AGENTS.md` + `SOUL.md` from the system sandbox. There is
 * no longer a free-form `system_prompt` column on `agent`; the
 * persona files are the single source of agent personality, edited
 * via the Identity / Instructions tabs in the agent settings UI.
 *
 * Side-effect-free apart from one DB read and a `getSystemSandbox`
 * call inside `composeSystemPrompt`. Both must already be cheap
 * (the system sandbox is resumed by the time `startupSystemSandbox`
 * has returned in the calling handler).
 *
 * The returned `pending` is the per-event mutation buffer. The
 * caller MUST pass it to `endOfEvent` so writes get flushed; if a
 * handler bails before reaching `endOfEvent`, the queue is dropped
 * and on-disk memory is left untouched.
 */
export interface BuildAgentArgs {
  agentId: string
  /**
   * Identifier used by per-tool sub-steps for run correlation. For
   * heartbeats this is the `runs.id`; for chat turns it's the
   * conversation id (there's no `runs` row).
   */
  runId: string
  /**
   * UTC ISO time embedded in the system prompt so the model has a
   * stable "now". Defaults to the current process clock.
   */
  nowIso?: string
}

export interface BuildAgentResult {
  agent: DurableAgent
  /** Per-event memory mutation buffer. Pass to `endOfEvent`. */
  pending: PendingWrites
  /**
   * Snapshot of the agent row used to build the agent. Convenient for
   * the caller to log model id without re-reading.
   */
  meta: {
    name: string
    model: string
  }
}

export async function buildAgent(
  args: BuildAgentArgs,
): Promise<BuildAgentResult> {
  const { agentId } = args
  // runId is currently unused inside this function — every tool's
  // step gets the agentId only — but keeping it on the signature
  // means tools that later need run-scoped behaviour (e.g. emitting
  // step events to `events:${runId}`) can adopt it without changing
  // every call site.
  void args.runId

  const [row] = await db
    .select({
      name: agent.name,
      model: agent.model,
    })
    .from(agent)
    .where(eq(agent.id, agentId))
    .limit(1)
  if (!row) {
    throw new Error(`buildAgent: agent ${agentId} not found`)
  }

  // composeSystemPrompt resumes the system sandbox and reads the
  // persona files. Cheap in the steady state — the sandbox is already
  // hot from `startupSystemSandbox` + `drainPendingWrites`.
  const systemSandbox = await getSystemSandbox(agentId)
  const systemPrompt = await composeSystemPrompt({
    agentName: row.name,
    systemSandbox,
    nowIso: args.nowIso ?? new Date().toISOString(),
  })

  const pending = createPendingWrites()

  const memoryTools = createMemoryTools({ agentId, pending })
  // The exec tools also receive `pending` so the bash audit log can
  // enqueue an append op into the shared per-event buffer instead of
  // doing a synchronous round-trip to the system sandbox per call.
  // `createExecTools` is synchronous — every tool delegates to a
  // `"use step"` worker, so there's nothing to resume at construction
  // time.
  const execTools = createExecTools({ agentId, pending })

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
    : "This is your first heartbeat — there is no prior run to compare against."
  return [
    `It is now ${args.nowIso}. This is your scheduled heartbeat.`,
    sinceClause,
    "",
    "Use this time to:",
    "  1. Read your TASKS.md and CALENDAR.md to see what's pending.",
    "  2. Make incremental progress on anything you can finish quickly with",
    "     your available tools.",
    "  3. Update memory files with anything new you learned or decided.",
    "  4. Append one bullet to today's log under logs/<YYYY-MM-DD>.md",
    "     summarising what happened during this heartbeat.",
    "",
    "Be terse. Stop when there is nothing more useful to do — do not",
    "manufacture work. A heartbeat that simply logs 'no changes' is fine.",
  ].join("\n")
}
