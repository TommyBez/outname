import 'server-only'
import { getRun } from 'workflow/api'

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled'])

export async function isWorkflowRunAlive(
  workflowRunId: string
): Promise<boolean> {
  try {
    const run = getRun(workflowRunId)
    const status = await run.status
    return typeof status === 'string' && !TERMINAL_STATUSES.has(status)
  } catch {
    return false
  }
}

export async function readWorkflowRunStatus(
  workflowRunId: string
): Promise<string | null> {
  try {
    const run = getRun(workflowRunId)
    const status = await run.status
    return typeof status === 'string' ? status : null
  } catch (err) {
    if (isWorkflowRunNotFound(err)) {
      return 'not_found'
    }
    return null
  }
}

function isWorkflowRunNotFound(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { name?: unknown }).name === 'WorkflowRunNotFoundError'
  )
}
