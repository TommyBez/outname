import { getWorkflowMetadata } from 'workflow'

export async function beginHeartbeatRun(input: {
  agentId: string
}): Promise<{ runId: string }> {
  'use step'

  await Promise.resolve()
  return { runId: currentWorkflowRunId(input.agentId) }
}

function currentWorkflowRunId(agentId: string): string {
  try {
    const metadata = getWorkflowMetadata() as {
      runId?: string
      workflowRunId?: string
    }
    const runId = metadata.runId ?? metadata.workflowRunId
    if (runId) {
      return runId
    }
  } catch {
    // Outside workflow context, fall back to a stable-enough id.
  }
  return agentId
}
