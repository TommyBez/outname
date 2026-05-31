import 'server-only'
import { getWorkflowMetadata } from '@outname/workflow/runtime'

export function currentWorkflowRunId(): string {
  return getWorkflowMetadata().workflowRunId
}
