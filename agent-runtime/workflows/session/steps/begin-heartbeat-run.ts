import { getWorkflowMetadata } from 'workflow'

/**
 * Returns the workflow runtime id for a heartbeat/reflection event.
 * Phase 5 removed the legacy app-level `runs` row; the runtime id is
 * enough for stream namespacing, source attribution, and low-level
 * workflow observability.
 */
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
    // Outside a workflow context (e.g. unit tests) use a stable-enough
    // fallback instead of reintroducing an app-level run table.
  }
  return agentId
}
