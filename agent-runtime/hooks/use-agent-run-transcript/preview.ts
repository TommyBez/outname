import type { AgentChatMessage } from '@/agent-runtime/server/chat-status'
import type { AgentRunTranscriptState } from './types'

export function getAgentRunTranscriptPreview(input: {
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
    return `Last dream ${formatRelativeTime(lastReflectionAt)}`
  }
  return 'No run transcript streamed yet.'
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
