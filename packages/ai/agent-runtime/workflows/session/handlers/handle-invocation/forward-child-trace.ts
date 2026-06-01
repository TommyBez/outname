import type {
  AgentChatChunk,
  AgentChatMessage,
} from '@outname/ai/agent-runtime/server/chat-status'
import type { SubAgentToolOutput } from '@outname/ai/agent-runtime/server/sub-agent-tool-output'
import { getRun } from '@outname/workflow/api'
import { readUIMessageStream, type UIMessageChunk } from 'ai'

export function startForwardingChildTrace(input: {
  childAgentId: string
  childName: string
  namespace: string
  parentStream: WritableStream<UIMessageChunk> | null
  parentToolCallId: string | null
  runId: string
  toolName: string
}): Promise<AgentChatMessage[]> {
  if (!(input.parentStream && input.parentToolCallId)) {
    return Promise.resolve([])
  }

  return forwardChildTraceToParent({
    childAgentId: input.childAgentId,
    childName: input.childName,
    namespace: input.namespace,
    parentStream: input.parentStream,
    parentToolCallId: input.parentToolCallId,
    runId: input.runId,
    toolName: input.toolName,
  }).catch((err) => {
    console.error('handleInvocation: failed to forward child trace', err)
    return []
  })
}

async function forwardChildTraceToParent(input: {
  childAgentId: string
  childName: string
  namespace: string
  parentStream: WritableStream<UIMessageChunk>
  parentToolCallId: string
  runId: string
  toolName: string
}): Promise<AgentChatMessage[]> {
  'use step'
  const messages: AgentChatMessage[] = []
  const readable = getRun(input.runId).getReadable<AgentChatChunk>({
    namespace: input.namespace,
    startIndex: 0,
  })

  for await (const message of readUIMessageStream<AgentChatMessage>({
    stream: readable,
    terminateOnError: false,
  })) {
    upsertMessage(messages, message)
    await writeParentSubAgentOutput({
      output: {
        childAgentId: input.childAgentId,
        childName: input.childName,
        kind: 'sub_agent',
        messages: messages.slice(),
        status: 'running',
        toolName: input.toolName,
      },
      parentStream: input.parentStream,
      parentToolCallId: input.parentToolCallId,
    })
  }

  return messages
}

async function writeParentSubAgentOutput(input: {
  output: SubAgentToolOutput
  parentStream: WritableStream<UIMessageChunk>
  parentToolCallId: string
}): Promise<void> {
  const writer = input.parentStream.getWriter()
  try {
    await writer.write({
      type: 'tool-output-available',
      output: input.output,
      preliminary: true,
      toolCallId: input.parentToolCallId,
    })
  } finally {
    writer.releaseLock()
  }
}

function upsertMessage(
  messages: AgentChatMessage[],
  message: AgentChatMessage
): void {
  const index = messages.findIndex((item) => item.id === message.id)
  if (index < 0) {
    messages.push(message)
    return
  }
  messages[index] = message
}
