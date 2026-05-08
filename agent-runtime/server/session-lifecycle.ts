import 'server-only'
import { eq } from 'drizzle-orm'
import { getRun, resumeHook, start } from 'workflow/api'
import { sessionToken } from '@/agent-runtime/workflows/session/events'
import { agentSessionWorkflow } from '@/agent-runtime/workflows/session/workflow'
import { db } from '@/shared/db'
import { type Agent, agent } from '@/shared/db/schema'

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled'])

export async function startAgentSession(
  a: Agent
): Promise<{ sessionRunId: string; started: boolean }> {
  const existing = await getRunningSessionRunId(a)
  if (existing) {
    return { sessionRunId: existing, started: false }
  }

  return doStart(a)
}

export async function restartAgentSession(
  a: Agent
): Promise<{ sessionRunId: string }> {
  const { sessionRunId } = await doStart(a)
  return { sessionRunId }
}

async function doStart(
  a: Agent
): Promise<{ sessionRunId: string; started: true }> {
  const run = await start(agentSessionWorkflow, [{ agentId: a.id }])

  await db
    .update(agent)
    .set({ lastSessionRunId: run.runId, updatedAt: new Date() })
    .where(eq(agent.id, a.id))

  return { sessionRunId: run.runId, started: true }
}

export async function stopAgentSession(agentId: string): Promise<void> {
  let prevRunId: string | null = null
  try {
    const rows = await db
      .select({ id: agent.lastSessionRunId })
      .from(agent)
      .where(eq(agent.id, agentId))
      .limit(1)
    prevRunId = rows[0]?.id ?? null
  } catch {
    // Best-effort: if we can't read the row we still attempt shutdown.
  }

  try {
    await resumeHook(sessionToken(agentId), { type: 'shutdown' })
  } catch (err) {
    console.error('[v0] stopAgentSession: resume failed', err)
    return
  }

  if (!prevRunId) {
    return
  }

  const deadlineMs = Date.now() + 5000
  const intervalMs = 250
  while (Date.now() < deadlineMs) {
    if (!(await isWorkflowRunAlive(prevRunId))) {
      return
    }
    await sleep(intervalMs)
  }

  console.warn(
    '[v0] stopAgentSession: run did not terminate within bound; ' +
      'liveness sweeper will recover.',
    { agentId, prevRunId }
  )
}

export async function getRunningSessionRunId(a: Agent): Promise<string | null> {
  if (!a.lastSessionRunId) {
    return null
  }
  return (await isWorkflowRunAlive(a.lastSessionRunId))
    ? a.lastSessionRunId
    : null
}

export async function isWorkflowRunAlive(
  workflowRunId: string
): Promise<boolean> {
  try {
    const run = getRun(workflowRunId)
    const status = await run.status
    if (typeof status !== 'string') {
      return false
    }
    return !TERMINAL_STATUSES.has(status)
  } catch {
    return false
  }
}

export function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}
