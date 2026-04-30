import type { UIMessageChunk } from 'ai'
import { and, desc, eq } from 'drizzle-orm'
import { getWritable } from 'workflow'
import { startupExecSandbox, startupSystemSandbox } from '@/lib/agent-sandbox'
import { db } from '@/lib/db'
import { runs } from '@/lib/db/schema'
import { buildAgent, buildHeartbeatKickoff } from '../agent-factory'
import { beginHeartbeatRun } from '../steps/begin-heartbeat-run'
import { drainPendingWrites } from '../steps/drain-pending-writes'
import { finalizeRun } from '../steps/finalize-run'
import { initRun } from '../steps/init-run'
import type { PendingWrites } from '../tools/pending-writes'

/**
 * Heartbeat event handler — runs inside the long-lived session
 * workflow once per ticker tick (or once per "Trigger now" press).
 *
 * Phase 2 collapses the per-kind heartbeat lifecycle to a single
 * generic flow:
 *
 *   1. `beginHeartbeatRun` — insert a `runs` row, return its id.
 *   2. `initRun` — emit the canonical `started` event onto
 *      `events:${runId}` so `/runs/:runId/stream` lights up.
 *   3. Look up the previous successful heartbeat completion (best
 *      effort, just for the kickoff prompt).
 *   4. Boot both sandboxes — system is required (system prompt),
 *      exec is best-effort.
 *   5. Build the agent via `buildAgent` and stream it against the
 *      generic `buildHeartbeatKickoff` user message. The agent
 *      decides what to do based on its inlined AGENTS.md / SOUL.md
 *      and current memory inventory.
 *   6. `finalizeRun` — flip the runs row to `completed` (or
 *      `failed`).
 *
 * Errors are caught and converted to a failed `runs` row before
 * re-throwing so the session loop can surface them via its outer
 * try/catch without losing the run-level breadcrumb.
 *
 * Like `handleChat`, returns the per-event `pending` queue so
 * `agentSessionWorkflow` can flush it via `endOfEvent`.
 */
export async function handleHeartbeat(input: {
  agentId: string
}): Promise<{ pending: PendingWrites }> {
  const { agentId } = input

  const { runId } = await beginHeartbeatRun({ agentId })

  // Per-run namespace — the run's progress events live here. Distinct
  // from the chat per-turn namespace so the two flows never collide on
  // the session workflow's stream graph.
  const writable = getWritable<UIMessageChunk>({
    namespace: `heartbeat:${runId}`,
  })

  try {
    await initRun(runId)

    const previousIso = await readPreviousHeartbeatCompletion(agentId)

    await startupSystemSandbox({ agentId })
    await startupExecSandbox({ agentId }).catch((err) => {
      // Don't fail the heartbeat just because exec didn't boot — the
      // agent can still touch memory files. exec_* tools surface their
      // own errors per call.
      console.error('[v0] handleHeartbeat: startupExecSandbox failed', err)
    })

    // Drain UI-authored persona-file edits before composeSystemPrompt
    // reads them inside buildAgent.
    await drainPendingWrites({ agentId })

    const { agent, pending } = await buildAgent({
      agentId,
      runId,
      currentRunId: runId,
    })

    const kickoff = buildHeartbeatKickoff({
      nowIso: new Date().toISOString(),
      previousIso,
    })

    await agent.stream({
      messages: [{ role: 'user', content: kickoff }],
      writable,
      maxSteps: 60,
    })

    await finalizeRun(runId, 'completed')

    return { pending }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await finalizeRun(runId, 'failed', message)
    throw err
  }
}

/**
 * Best-effort lookup of the most recent completed run for this agent.
 * Returns `null` if there isn't one (first heartbeat, or all prior
 * heartbeats failed). Used purely as a hint in the kickoff message.
 */
async function readPreviousHeartbeatCompletion(
  agentId: string
): Promise<string | null> {
  'use step'
  const [prev] = await db
    .select({ completedAt: runs.completedAt })
    .from(runs)
    .where(and(eq(runs.agentId, agentId), eq(runs.status, 'completed')))
    .orderBy(desc(runs.completedAt))
    .limit(1)
  return prev?.completedAt ? prev.completedAt.toISOString() : null
}
