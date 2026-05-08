import { readUIMessageStream } from 'ai'
import type { Dispatch, SetStateAction } from 'react'
import type {
  AgentChatChunk,
  AgentChatMessage,
} from '@/agent-runtime/server/chat-status'
import type { AgentRunTranscriptState } from './types'

interface StreamErrorBody {
  error?: string
  status?: string
}

export async function consumeRunTranscript(input: {
  abort: AbortController
  agentId: string
  ctx: { cancelled: boolean }
  setState: Dispatch<SetStateAction<AgentRunTranscriptState>>
}): Promise<void> {
  const { abort, agentId, ctx, setState } = input
  try {
    const res = await fetch(
      `/api/agents/${encodeURIComponent(agentId)}/run-transcript/stream`,
      { signal: abort.signal }
    )
    if (!(res.ok && res.body)) {
      const message = await readStreamError(res)
      if (!ctx.cancelled) {
        setState((prev) => ({
          kind: res.status === 409 ? 'unavailable' : 'failed',
          message,
          messages: prev.messages,
        }))
      }
      return
    }

    const stream = createChunkStream({ body: res.body, ctx })
    for await (const message of readUIMessageStream<AgentChatMessage>({
      stream,
      terminateOnError: false,
    })) {
      if (ctx.cancelled) {
        return
      }
      setState((prev) => ({
        kind: 'streaming',
        messages: upsertMessage(prev.messages, message),
      }))
    }
  } catch (err) {
    if (ctx.cancelled || abort.signal.aborted) {
      return
    }
    setState((prev) => ({
      kind: 'failed',
      message: err instanceof Error ? err.message : 'Run transcript failed',
      messages: prev.messages,
    }))
  }
}

async function readStreamError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as StreamErrorBody
    return body.error ?? `Run transcript unavailable (${res.status})`
  } catch {
    return `Run transcript unavailable (${res.status})`
  }
}

function createChunkStream(input: {
  body: ReadableStream<Uint8Array>
  ctx: { cancelled: boolean }
}): ReadableStream<AgentChatChunk> {
  return new ReadableStream<AgentChatChunk>({
    async start(controller) {
      const reader = input.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      try {
        while (!input.ctx.cancelled) {
          const { done, value } = await reader.read()
          if (done) {
            break
          }
          buffer += decoder.decode(value, { stream: true })
          buffer = drainLines(buffer, (chunk) => controller.enqueue(chunk))
        }
        if (!input.ctx.cancelled) {
          controller.close()
        }
      } catch (err) {
        if (!input.ctx.cancelled) {
          controller.error(err)
        }
      } finally {
        reader.releaseLock()
      }
    },
    cancel() {
      input.ctx.cancelled = true
    },
  })
}

function drainLines(
  buffer: string,
  onChunk: (chunk: AgentChatChunk) => void
): string {
  let working = buffer
  let nl = working.indexOf('\n')
  while (nl >= 0) {
    const line = working.slice(0, nl).trim()
    working = working.slice(nl + 1)
    nl = working.indexOf('\n')
    if (!line) {
      continue
    }
    try {
      onChunk(JSON.parse(line) as AgentChatChunk)
    } catch {
      // The stream is best-effort; ignore malformed transcript lines.
    }
  }
  return working
}

function upsertMessage(
  messages: AgentChatMessage[],
  message: AgentChatMessage
): AgentChatMessage[] {
  const existingIndex = messages.findIndex((item) => item.id === message.id)
  if (existingIndex < 0) {
    return [...messages, message]
  }

  const next = messages.slice()
  next[existingIndex] = message
  return next
}
