import { eq } from 'drizzle-orm'
import { getHookByToken, getRun } from 'workflow/api'
import { db } from '@/lib/db'
import { agent } from '@/lib/db/schema'
import { sessionToken } from '../events'

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled'])

export async function isCurrentSessionOwner(input: {
  agentId: string
  sessionRunId: string
}): Promise<boolean> {
  'use step'
  const [row] = await db
    .select({ lastSessionRunId: agent.lastSessionRunId })
    .from(agent)
    .where(eq(agent.id, input.agentId))
    .limit(1)

  if (row?.lastSessionRunId !== input.sessionRunId) {
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
