import { agentEventWorkflow } from '@outname/ai/agent-runtime/workflows/events/workflow'
import { start } from 'workflow/api'
import {
  type AgentToolHandle,
  buildAgentToolCore,
  type DispatchSubAgentInvocationInput,
} from './agent-tool'

export function buildRealtimeAgentTool(handle: AgentToolHandle) {
  return buildAgentToolCore(handle, dispatchSubAgentInvocation)
}

async function dispatchSubAgentInvocation(
  input: DispatchSubAgentInvocationInput
): Promise<{ sessionRunId: string }> {
  const { handle, instruction, streamToken, toolCallId } = input
  const { dispatchInvocation } = await import(
    '@outname/ai/agent-runtime/server/agent-invocation-events'
  )
  return await dispatchInvocation({
    childAgentId: handle.childAgentId,
    childUserId: handle.childUserId,
    parentUserId: handle.parentUserId,
    parentRunId: handle.parentRunId,
    parentToolId: handle.parentToolId,
    parentToolCallId: toolCallId,
    instruction,
    streamToken,
    callStack: [...handle.parentCallStack, handle.parentAgentId],
    depth: handle.parentDepth + 1,
    startWorkflowRun: async (eventId) => {
      const run = await start(agentEventWorkflow, [{ eventId }])
      return run.runId
    },
  })
}
