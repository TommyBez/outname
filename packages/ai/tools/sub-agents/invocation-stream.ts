import type {
  AgentChatChunk,
  AgentChatMessage,
} from '@outname/ai/agent-runtime/server/chat-status'
import type { SubAgentToolOutput } from '@outname/ai/agent-runtime/server/sub-agent-tool-output'
import { upsertMessage } from '@outname/ai/agent-runtime/shared/message-utils'
import { getRun } from '@outname/workflow/api'
import { readUIMessageStream } from 'ai'
import {
  type SubAgentProgressTarget,
  writePreliminarySubAgentOutput,
} from './progress-target'

export async function collectSubAgentMessages(input: {
  progress?: {
    childAgentId: string
    childName: string
    target: SubAgentProgressTarget
    toolCallId: string | null
    toolName: string
  }
  sessionRunId: string
  streamToken: string
}): Promise<{ error: string | null; messages: AgentChatMessage[] }> {
  'use step'
  let messages: AgentChatMessage[] = []
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
    messages = upsertMessage(messages, message)
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
    target: SubAgentProgressTarget
    toolCallId: string | null
    toolName: string
  } | null
}): Promise<void> {
  const progress = input.progress
  if (!(progress?.target && progress.toolCallId)) {
    return
  }

  const output = {
    childAgentId: progress.childAgentId,
    childName: progress.childName,
    kind: 'sub_agent',
    messages: input.messages.slice(),
    status: 'running',
    toolName: progress.toolName,
  } satisfies SubAgentToolOutput

  await writePreliminarySubAgentOutput({
    output,
    target: progress.target,
    toolCallId: progress.toolCallId,
  })
}
