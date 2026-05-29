import 'server-only'
import { getWorkflowMetadata } from 'workflow'

export function currentWorkflowRunId(): string {
  return getWorkflowMetadata().workflowRunId
}
