import 'server-only'
import { agentEventWorkflow } from '@outname/ai/agent-runtime/workflows/events/workflow'
import { start } from 'workflow/api'

export async function startAgentEventWorkflowRun(
  eventId: string
): Promise<string> {
  const run = await start(agentEventWorkflow, [{ eventId }])
  return run.runId
}
