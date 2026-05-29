import 'server-only'
import { start } from 'workflow/api'
import { agentEventWorkflow } from '@/agent-runtime/workflows/events/workflow'

export async function startAgentEventWorkflowRun(
  eventId: string
): Promise<string> {
  const run = await start(agentEventWorkflow, [{ eventId }])
  return run.runId
}
