import "server-only"
import { start } from "workflow/api"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { agent, runs, type Agent, type RunTrigger } from "@/lib/db/schema"
import { isAgentKind } from "@/workflows/agents/registry"
import { getAgentRuntime } from "@/lib/agent-runtime-registry"

function nanoid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/**
 * Dispatch an agent run by kind. Keeps the wiring (DB row + workflow start +
 * workflowRunId backfill) in one place so both the manual trigger route and
 * the daily cron use the same code path.
 *
 * The per-kind workflow function is looked up in `AGENT_RUNTIMES` so adding
 * a new kind does not require touching this file.
 *
 * Returns the internal runId (not the Workflow SDK's runtime id).
 */
export async function startAgentRun(opts: {
  agent: Agent
  trigger: RunTrigger
  scheduledFor?: Date | null
}): Promise<{ runId: string; workflowRunId: string }> {
  const { agent: a, trigger, scheduledFor } = opts
  if (!isAgentKind(a.kind)) {
    throw new Error(`Unknown agent kind: ${a.kind}`)
  }

  const runtime = getAgentRuntime(a.kind)
  if (!runtime?.cronWorkflow) {
    throw new Error(`Agent kind "${a.kind}" has no cron workflow registered.`)
  }

  const runId = nanoid()

  await db.insert(runs).values({
    id: runId,
    agentId: a.id,
    status: scheduledFor && scheduledFor.getTime() > Date.now() ? "scheduled" : "running",
    trigger,
    scheduledFor: scheduledFor ?? null,
    startedAt: new Date(),
  })

  try {
    const run = await start(runtime.cronWorkflow, [
      {
        runId,
        agentId: a.id,
        scheduledForMs: scheduledFor ? scheduledFor.getTime() : undefined,
      },
    ])
    await db
      .update(runs)
      .set({ workflowRunId: run.runId })
      .where(eq(runs.id, runId))
    return { runId, workflowRunId: run.runId }
  } catch (err) {
    await db
      .update(runs)
      .set({
        status: "failed",
        completedAt: new Date(),
        error: err instanceof Error ? err.message : String(err),
      })
      .where(eq(runs.id, runId))
    throw err
  }
}

export async function getAgentById(agentId: string): Promise<Agent | null> {
  const [row] = await db.select().from(agent).where(eq(agent.id, agentId)).limit(1)
  return row ?? null
}
