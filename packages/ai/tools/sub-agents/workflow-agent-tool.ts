import { getWorkflowMetadata } from 'workflow'
import { start } from 'workflow/api'
import {
  type AgentToolHandle,
  buildAgentToolCore,
  type DispatchSubAgentInvocationInput,
} from './agent-tool'

export function buildWorkflowAgentTool(handle: AgentToolHandle) {
  return buildAgentToolCore(handle, dispatchSubAgentInvocation)
}

async function dispatchSubAgentInvocation(
  input: DispatchSubAgentInvocationInput
): Promise<{ sessionRunId: string }> {
  'use step'
  const { handle, instruction, streamToken, toolCallId } = input
  const { workflowName } = getWorkflowMetadata()
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
      const run = await start({ workflowId: workflowName }, [{ eventId }])
      return run.runId
    },
  })
}
