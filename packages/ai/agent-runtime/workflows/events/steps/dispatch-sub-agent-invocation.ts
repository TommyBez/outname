import type { StartAgentEventWorkflowRun } from '@outname/ai/agent-runtime/server/agent-event-start'
import { dispatchInvocation } from '@outname/ai/agent-runtime/server/agent-invocation-events'
import type { DispatchSubAgentInvocationInput } from '@outname/ai/tools/sub-agents/agent-tool'

export async function dispatchInvocationForWorkflow(
  input: DispatchSubAgentInvocationInput & {
    startWorkflowRun: StartAgentEventWorkflowRun
  }
): Promise<{ sessionRunId: string }> {
  const { handle, instruction, startWorkflowRun, streamToken, toolCallId } =
    input
  const result = await dispatchInvocation({
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
    startWorkflowRun,
  })

  return { sessionRunId: result.sessionRunId }
}
