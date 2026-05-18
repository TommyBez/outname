import { getWorkflowMetadata } from 'workflow'

export async function beginInvocationRun(input: {
  agentId: string
  parentRunId: string | null
  parentToolId: string | null
  streamToken: string
}): Promise<string> {
  'use step'
  await Promise.resolve()
  return currentWorkflowRunId(input)
}

export function invocationMessageId(): string {
  return `inv_msg_${Math.random().toString(36).slice(2, 10)}`
}

function currentWorkflowRunId(input: {
  agentId: string
  streamToken: string
}): string {
  const metadata = getWorkflowMetadata() as {
    runId?: string
    workflowRunId?: string
  }
  const runId = metadata.runId ?? metadata.workflowRunId
  if (runId) {
    return runId
  }
  return input.streamToken
}
