import 'server-only'

const LEGACY_STARTING_WORKFLOW_RUN_PREFIX = 'starting:'

export function readableAgentEventWorkflowRunId(
  workflowRunId: string | null
): string | null {
  // Release-transition tolerance for rows written before C5 removed the
  // synthetic starting:<eventId> sentinel.
  // TODO(remove after next release): drop once no deployed writer can emit it.
  if (
    workflowRunId === null ||
    workflowRunId.startsWith(LEGACY_STARTING_WORKFLOW_RUN_PREFIX)
  ) {
    return null
  }
  return workflowRunId
}
