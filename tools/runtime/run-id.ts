import { getWorkflowMetadata } from 'workflow'

let fallbackRunId: string | null = null

export function currentToolRuntimeRunId(): string {
  if (typeof getWorkflowMetadata === 'function') {
    try {
      const metadata = getWorkflowMetadata()
      if (
        typeof metadata?.workflowRunId === 'string' &&
        metadata.workflowRunId
      ) {
        return metadata.workflowRunId
      }
    } catch {
      // Fall back below for tests and non-workflow server contexts.
    }
  }

  fallbackRunId ??= `standalone-${crypto.randomUUID()}`
  return fallbackRunId
}
