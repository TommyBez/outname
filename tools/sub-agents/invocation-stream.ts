import { readUIMessageStream, type UIMessageChunk } from 'ai'
import { getWritable } from 'workflow'
import { getRun } from 'workflow/api'
import type {
  AgentChatChunk,
  AgentChatMessage,
} from '@/agent-runtime/server/chat-status'
import type { SubAgentToolOutput } from '@/agent-runtime/server/sub-agent-tool-output'

export async function collectSubAgentMessages(input: {
  progress?: {
    childAgentId: string
    childName: string
    streamNamespace: string | null
    toolCallId: string | null
    toolName: string
  }
  sessionRunId: string
  streamToken: string
}): Promise<{ error: string | null; messages: AgentChatMessage[] }> {
  'use step'
  const messages: AgentChatMessage[] = []
  let streamError: string | null = null
  const readable = getRun(input.sessionRunId).getReadable<AgentChatChunk>({
    namespace: input.streamToken,
    startIndex: 0,
  })

  for await (const message of readUIMessageStream<AgentChatMessage>({
    onError(error) {
      streamError = error instanceof Error ? error.message : String(error)
    },
    stream: readable,
    terminateOnError: false,
  })) {
    upsertMessage(messages, message)
    await emitProgressUpdate({
      messages,
      progress: input.progress ?? null,
    })
  }

  return { error: streamError, messages }
}

async function emitProgressUpdate(input: {
  messages: AgentChatMessage[]
  progress: {
    childAgentId: string
    childName: string
    streamNamespace: string | null
    toolCallId: string | null
    toolName: string
  } | null
}): Promise<void> {
  const progress = input.progress
  if (!(progress?.streamNamespace && progress.toolCallId)) {
    return
  }

  try {
    const writable = getWritable<UIMessageChunk>({
      namespace: progress.streamNamespace,
    })
    const writer = writable.getWriter()
    try {
      await writer.write({
        type: 'tool-output-available',
        output: {
          childAgentId: progress.childAgentId,
          childName: progress.childName,
          kind: 'sub_agent',
          messages: input.messages.slice(),
          status: 'running',
          toolName: progress.toolName,
        } satisfies SubAgentToolOutput,
        preliminary: true,
        toolCallId: progress.toolCallId,
      })
    } finally {
      writer.releaseLock()
    }
  } catch {
    // Progressive parent updates are UX enhancements and must not fail the child run.
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
