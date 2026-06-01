import 'server-only'
import { start } from '@outname/workflow/api'
import { agentEventWorkflow } from './workflow'

export async function startAgentEventWorkflowRun(
  eventId: string
): Promise<string> {
  const run = await start(agentEventWorkflow, [{ eventId }])
  return run.runId
}
