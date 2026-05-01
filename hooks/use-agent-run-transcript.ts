'use client'

import { readUIMessageStream } from 'ai'
import type { Dispatch, SetStateAction } from 'react'
import { useEffect, useState } from 'react'
import type { AgentChatChunk, AgentChatMessage } from '@/lib/agent-chat-status'

export type AgentRunTranscriptState =
  | { kind: 'idle'; messages: AgentChatMessage[] }
  | { kind: 'connecting'; messages: AgentChatMessage[] }
  | { kind: 'streaming'; messages: AgentChatMessage[] }
  | { kind: 'unavailable'; messages: AgentChatMessage[]; message: string }
  | { kind: 'failed'; messages: AgentChatMessage[]; message: string }

interface StreamErrorBody {
  error?: string
  status?: string
}

export function useAgentRunTranscript(input: {
  agentId: string
  enabled: boolean
  sessionRunId: string | null
}): AgentRunTranscriptState {
  const { agentId, enabled, sessionRunId } = input
  const [state, setState] = useState<AgentRunTranscriptState>({
    kind: 'idle',
    messages: [],
  })

  useEffect(() => {
    if (!(enabled && sessionRunId)) {
      setState({ kind: 'idle', messages: [] })
      return
    }

    const abort = new AbortController()
    const ctx = { cancelled: false }
    setState({ kind: 'connecting', messages: [] })

    consumeRunTranscript({
      abort,
      agentId,
      ctx,
      setState,
    })

    return () => {
      ctx.cancelled = true
      abort.abort()
    }
  }, [agentId, enabled, sessionRunId])

  return state
}

export function useAgentRunTranscriptPreview(input: {
  enabled: boolean
  lastHeartbeatAt: string | null
  lastReflectionAt: string | null
  sessionRunId: string | null
  streamState: AgentRunTranscriptState
}): string {
  const {
    enabled,
    lastHeartbeatAt,
    lastReflectionAt,
    sessionRunId,
    streamState,
  } = input
  const latest = latestMessagePreview(streamState.messages)
  if (latest) {
    return latest
  }
  if (streamState.kind === 'connecting') {
    return 'Connecting to run transcript...'
  }
  if (streamState.kind === 'unavailable' || streamState.kind === 'failed') {
    return streamState.message
  }
  if (!enabled) {
    return 'Paused. Enable this agent to resume activity.'
  }
  if (sessionRunId) {
    return 'Session is running. Waiting for the next run transcript.'
  }
  if (lastHeartbeatAt) {
    return `Last heartbeat ${formatRelativeTime(lastHeartbeatAt)}`
  }
  if (lastReflectionAt) {
    return `Last reflection ${formatRelativeTime(lastReflectionAt)}`
  }
  return 'No run transcript streamed yet.'
}

async function consumeRunTranscript(input: {
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

    const stream = createChunkStream({
      body: res.body,
      ctx,
    })

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

function latestMessagePreview(messages: AgentChatMessage[]): string | null {
  for (
    let messageIndex = messages.length - 1;
    messageIndex >= 0;
    messageIndex--
  ) {
    const message = messages[messageIndex]
    for (
      let partIndex = message.parts.length - 1;
      partIndex >= 0;
      partIndex--
    ) {
      const preview = partPreview(message.parts[partIndex])
      if (preview) {
        return truncate(preview)
      }
    }
  }
  return null
}

function partPreview(part: AgentChatMessage['parts'][number]): string | null {
  if (part.type === 'text' || part.type === 'reasoning') {
    return part.text.trim() || null
  }
  if (part.type === 'dynamic-tool') {
    const toolName = readString(toRecord(part).toolName) ?? 'tool'
    return `${toolName}: ${part.state}`
  }
  if (typeof part.type === 'string' && part.type.startsWith('tool-')) {
    const state = readString(toRecord(part).state) ?? 'streaming'
    return `${part.type.slice('tool-'.length)}: ${state}`
  }
  if (part.type === 'source-url') {
    return `Source: ${part.title ?? part.url}`
  }
  if (part.type === 'source-document') {
    return `Source document: ${part.title}`
  }
  if (part.type === 'file') {
    return `File attached: ${part.mediaType}`
  }
  return null
}

function formatRelativeTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'recently'
  }

  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.max(0, Math.round(diffMs / 60_000))
  if (diffMinutes < 1) {
    return 'just now'
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`
  }
  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) {
    return `${diffHours}h ago`
  }
  const diffDays = Math.round(diffHours / 24)
  return `${diffDays}d ago`
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function toRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {}
}

function truncate(value: string, maxLength = 120): string {
  return value.length > maxLength
    ? `${value.slice(0, maxLength - 3)}...`
    : value
}
