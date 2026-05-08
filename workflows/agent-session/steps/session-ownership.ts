import { eq } from 'drizzle-orm'
import { getHookByToken, getRun } from 'workflow/api'
import { db } from '@/lib/db'
import { agent } from '@/lib/db/schema'
import { sessionToken } from '../events'

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled'])

export async function isCurrentSessionOwner(input: {
  agentId: string
  sessionRunId: string
  sessionStartToken?: string
}): Promise<boolean> {
  'use step'
  const [row] = await db
    .select({
      lastSessionRunId: agent.lastSessionRunId,
      sessionStartExpiresAt: agent.sessionStartExpiresAt,
      sessionStartToken: agent.sessionStartToken,
    })
    .from(agent)
    .where(eq(agent.id, input.agentId))
    .limit(1)

  if (!row) {
    return false
  }

  const ownsPersistedRun = row.lastSessionRunId === input.sessionRunId
  const ownsStartupLease =
    input.sessionStartToken !== undefined &&
    row.sessionStartToken === input.sessionStartToken &&
    row.sessionStartExpiresAt !== null &&
    row.sessionStartExpiresAt.getTime() > Date.now()

  if (!(ownsPersistedRun || ownsStartupLease)) {
    return false
  }

  try {
    const hook = await getHookByToken(sessionToken(input.agentId))
    return (
      hook.runId === input.sessionRunId ||
      !(await isWorkflowRunAlive(hook.runId))
    )
  } catch (err) {
    if (isHookNotFoundError(err)) {
      return true
    }
    throw err
  }
}

function isHookNotFoundError(err: unknown): boolean {
  return err instanceof Error && err.name === 'HookNotFoundError'
}

async function isWorkflowRunAlive(workflowRunId: string): Promise<boolean> {
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
