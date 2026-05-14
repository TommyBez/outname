import type { UIMessageChunk } from 'ai'
import { getRun } from 'workflow/api'
import type { AgentEventPayloads } from '@/agent-runtime/server/agent-event-store'
import { getSlackAdapter, getSlackBot } from './bot'

export async function forwardSlackStreamToThread(input: {
  channelId: string
  eventId: string
  replyNamespace: string
  recipientUserId?: string
  teamId: string
  threadTs: string
  workflowRunId: string
}): Promise<void> {
  'use step'
  const bot = getSlackBot()
  await bot.initialize()

  const adapter = getSlackAdapter()
  const install = await adapter.getInstallation(input.teamId)
  if (!install) {
    throw new Error(`Slack workspace ${input.teamId} is not installed`)
  }

  const recipientUserId = await resolveRecipientUserId(input)
  const threadId = `slack:${input.channelId}:${input.threadTs}`
  const readable = getRun(input.workflowRunId).getReadable<UIMessageChunk>({
    namespace: input.replyNamespace,
    startIndex: 0,
  })

  await adapter.withBotToken(install.botToken, async () => {
    const textIterable = chunksToTextIterable(readable)
    if (recipientUserId) {
      await adapter.stream(threadId, textIterable, {
        recipientTeamId: input.teamId,
        recipientUserId,
      })
      return
    }

    const text = await collectText(textIterable)
    if (text.trim()) {
      await adapter.postMessage(threadId, text)
    }
  })
}

async function resolveRecipientUserId(input: {
  eventId: string
  recipientUserId?: string
}): Promise<string | null> {
  const direct = normalizeSlackUserId(input.recipientUserId)
  if (direct) {
    return direct
  }

  const { getAgentEvent } = await import(
    '@/agent-runtime/server/agent-event-store'
  )
  const event = await getAgentEvent(input.eventId)
  const payload = event?.payload as Partial<AgentEventPayloads['chat']> | null
  const fromPayload = normalizeSlackUserId(payload?.slack?.recipientUserId)
  if (fromPayload) {
    return fromPayload
  }

  const uiMessages = Array.isArray(payload?.uiMessages)
    ? payload.uiMessages
    : []
  for (const message of uiMessages) {
    if (!(isRecord(message) && isRecord(message.metadata))) {
      continue
    }
    const fromMetadata = normalizeSlackUserId(message.metadata.externalUserId)
    if (fromMetadata) {
      return fromMetadata
    }
  }

  return null
}

function normalizeSlackUserId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed && trimmed !== 'unknown' ? trimmed : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

async function collectText(
  textIterable: AsyncIterable<string>
): Promise<string> {
  let text = ''
  for await (const chunk of textIterable) {
    text += chunk
  }
  return text
}

async function* chunksToTextIterable(
  readable: ReadableStream<UIMessageChunk>
): AsyncGenerator<string, void, unknown> {
  const reader = readable.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        return
      }
      if (!value || typeof value !== 'object') {
        continue
      }
      const chunk = value as { delta?: unknown; type?: string }
      if (chunk.type === 'text-delta' && typeof chunk.delta === 'string') {
        yield chunk.delta
      }
    }
  } finally {
    reader.releaseLock()
  }
}
