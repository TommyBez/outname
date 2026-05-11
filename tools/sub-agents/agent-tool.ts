import { tool, type UIMessageChunk } from 'ai'
import { getWritable } from 'workflow'
import { z } from 'zod'
import type { AgentChatMessage } from '@/agent-runtime/server/chat-status'
import { dispatchInvocation } from '@/agent-runtime/server/session-events'
import {
  isSubAgentToolOutput,
  type SubAgentToolOutput,
  subAgentModelText,
} from '@/agent-runtime/server/sub-agent-tool-output'
import { collectSubAgentMessages } from './invocation-stream'

export interface AgentToolHandle {
  childAgentId: string
  childCapabilitySummary: string | null
  childName: string
  childUserId: string
  parentAgentId: string
  // Append the current parent id before dispatch so the child sees the full
  // lineage and can still reject a cycle.
  parentCallStack: string[]
  parentDepth: number
  parentRunId: string | null
  parentToolId: string
  parentUserId: string
  streamNamespace?: string | null
}

// This tool dispatches an invocation event to a child agent and then tails the
// child's stream until completion. Cycle and depth checks already happened in
// `resolveToolPlan`.
export function buildAgentTool(handle: AgentToolHandle) {
  const description = composeDescription(handle)

  return tool({
    description,
    inputSchema: z.object({
      instruction: z
        .string()
        .min(1)
        .max(8000)
        .describe(
          [
            'A self-contained task description for the sub-agent.',
            'Include all context the sub-agent needs — it does not see',
            'the parent conversation or memory. Reply will be plain',
            'text returned as the tool result.',
          ].join(' ')
        ),
    }),
    async execute({ instruction }, { toolCallId }) {
      const streamToken = newInvocationStreamToken()
      const messages: AgentChatMessage[] = []
      await emitPreliminarySubAgentOutput({
        output: subAgentOutput({
          handle,
          messages,
          status: 'running',
        }),
        streamNamespace: handle.streamNamespace ?? null,
        toolCallId,
      })

      try {
        const { sessionRunId } = await dispatchSubAgentInvocation({
          handle,
          instruction,
          streamToken,
          toolCallId,
        })
        const { error, messages: childMessages } =
          await collectSubAgentMessages({
            sessionRunId,
            streamToken,
          })
        if (error) {
          return subAgentOutput({
            error,
            handle,
            messages: childMessages,
            status: 'failed',
          })
        }
        const finalText = extractFinalText(childMessages)
        if (!finalText) {
          return subAgentOutput({
            error: 'sub-agent finished without a final text reply',
            handle,
            messages: childMessages,
            status: 'failed',
          })
        }
        return subAgentOutput({
          finalText,
          handle,
          messages: childMessages,
          status: 'completed',
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return subAgentOutput({
          error: message,
          handle,
          messages,
          status: 'failed',
        })
      }
    },
    toModelOutput: ({ output }) => ({
      type: 'text',
      value: modelOutputText(output),
    }),
  })
}

function modelOutputText(output: unknown): string {
  if (typeof output === 'string') {
    return output
  }
  if (isSubAgentToolOutput(output)) {
    return subAgentModelText(output)
  }
  return String(output)
}

async function dispatchSubAgentInvocation(input: {
  handle: AgentToolHandle
  instruction: string
  streamToken: string
  toolCallId: string
}): Promise<{ sessionRunId: string }> {
  'use step'
  const { handle, instruction, streamToken, toolCallId } = input
  const parentStream = handle.streamNamespace
    ? getWritable<UIMessageChunk>({ namespace: handle.streamNamespace })
    : null
  return await dispatchInvocation({
    childAgentId: handle.childAgentId,
    childUserId: handle.childUserId,
    parentUserId: handle.parentUserId,
    parentRunId: handle.parentRunId,
    parentToolId: handle.parentToolId,
    parentToolCallId: toolCallId,
    parentStream,
    instruction,
    streamToken,
    callStack: [...handle.parentCallStack, handle.parentAgentId],
    depth: handle.parentDepth + 1,
  })
}

async function emitPreliminarySubAgentOutput(input: {
  output: SubAgentToolOutput
  streamNamespace: string | null
  toolCallId: string
}): Promise<void> {
  'use step'
  if (!input.streamNamespace) {
    return
  }

  try {
    const writable = getWritable<UIMessageChunk>({
      namespace: input.streamNamespace,
    })
    const writer = writable.getWriter()
    try {
      await writer.write({
        type: 'tool-output-available',
        output: input.output,
        preliminary: true,
        toolCallId: input.toolCallId,
      })
    } finally {
      writer.releaseLock()
    }
  } catch {
    // Live tool updates are UX hints and must not fail the call itself.
  }
}

function subAgentOutput(input: {
  error?: string
  finalText?: string
  handle: AgentToolHandle
  messages: AgentChatMessage[]
  status: SubAgentToolOutput['status']
}): SubAgentToolOutput {
  return {
    childAgentId: input.handle.childAgentId,
    childName: input.handle.childName,
    error: input.error,
    finalText: input.finalText,
    kind: 'sub_agent',
    messages: input.messages.slice(),
    status: input.status,
    toolName: input.handle.parentToolId,
  }
}

function composeDescription(handle: AgentToolHandle): string {
  const summary = handle.childCapabilitySummary?.trim()
  return (
    `Delegate a task to your sub-agent "${handle.childName}". ` +
    (summary ? `Capability summary: ${summary} ` : '') +
    'Provide a fully self-contained instruction; the sub-agent does ' +
    'not see your conversation, memory, or files unless you include ' +
    "them in the instruction. Returns the sub-agent's final text reply."
  )
}

function newInvocationStreamToken(): string {
  return (
    'inv_stream_' +
    Math.random().toString(36).slice(2, 10) +
    Date.now().toString(36).slice(-4)
  )
}

function extractFinalText(
  messages: readonly AgentChatMessage[]
): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (message.role !== 'assistant') {
      continue
    }
    const chunks: string[] = []
    for (const part of message.parts ?? []) {
      if (part.type === 'text' && typeof part.text === 'string') {
        chunks.push(part.text)
      }
    }
    if (chunks.length > 0) {
      return chunks.join('').trim()
    }
  }
  return null
}
