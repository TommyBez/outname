import 'server-only'
import type { UIMessage, UIMessageChunk } from 'ai'
import { nanoid } from 'nanoid'
import { revalidateTag } from 'next/cache'
import { getRun } from 'workflow/api'
import {
  slackConcurrencyKey,
  slackIdempotencyKey,
} from '@/agent-runtime/server/agent-event-keys'
import { dispatchChatTurn } from '@/agent-runtime/server/session-events'
import { insertChatMessage } from '@/chat/server/chat'
import { conversationListTag } from '@/shared/server/cache-tags'
import {
  ensureConversationForThread,
  resolveAgentsForIncomingMessage,
} from './routing'
import type { ChannelReplySink, IncomingChannelMessage } from './types'

// One inbound channel message can fan out to multiple user-owned agents bound to the same workspace.
export async function runChannelChatTurn(input: {
  message: IncomingChannelMessage
  sink: ChannelReplySink
}): Promise<boolean> {
  const { message, sink } = input

  const agents = await resolveAgentsForIncomingMessage(message)
  if (agents.length === 0) {
    return false
  }

  let handled = false
  for (const agent of agents) {
    if (!agent.enabled) {
      await sink.postError(
        `Agent "${agent.name}" is paused. Enable it from the dashboard before sending more messages.`
      )
      handled = true
      continue
    }

    const route = await ensureConversationForThread({ agent, message })

    const userUiMessage: UIMessage = {
      id: `msg_${nanoid(12)}`,
      role: 'user',
      parts: [{ type: 'text', text: message.text }],
      metadata: {
        source: message.channel,
        teamId: message.teamId || null,
        externalUserId: message.externalUserId,
        externalUserDisplayName: message.externalUserDisplayName ?? null,
        externalThreadKey: message.externalThreadKey,
      },
    }

    // Persist the user turn before dispatch so workflow failures do not erase the inbound message.
    await insertChatMessage({
      conversationId: route.conversationId,
      id: userUiMessage.id,
      role: 'user',
      parts: userUiMessage.parts,
      metadata: userUiMessage.metadata,
    })
    revalidateTag(conversationListTag(agent.id), 'max')

    await sink.startTyping?.('Thinking...')

    const slack = slackEventMetadata(agent.id, message)
    const { sessionRunId, replyToken, workflowRunId } = await dispatchChatTurn({
      agent,
      concurrencyKey: slack?.concurrencyKey,
      conversationId: route.conversationId,
      extraPayload: slack?.payload,
      idempotencyKey: slack?.idempotencyKey,
      source: message.channel,
      uiMessages: [userUiMessage],
    })

    if (slack) {
      if (!workflowRunId) {
        await sink.postReply(
          `Queued behind the current thread run for "${agent.name}".`
        )
      }
      handled = true
      continue
    }

    if (!sessionRunId) {
      await sink.postReply(`Queued event for "${agent.name}".`)
      handled = true
      continue
    }

    const readable = getRun(sessionRunId).getReadable<UIMessageChunk>({
      namespace: replyToken,
    })

    const textIterable = chunksToTextIterable(readable)
    await sink.postReply(textIterable)
    handled = true
  }
  return handled
}

function slackEventMetadata(
  agentId: string,
  message: IncomingChannelMessage
): {
  concurrencyKey: string
  idempotencyKey: string
  payload: Record<string, unknown>
} | null {
  if (message.channel !== 'slack') {
    return null
  }
  const channelId = readString(message.threadMetadata, 'slackChannel')
  const messageTs = readString(message.threadMetadata, 'slackMessageTs')
  const teamId = readString(message.threadMetadata, 'slackTeamId')
  const threadTs = readString(message.threadMetadata, 'slackThreadTs')
  if (!(channelId && messageTs && teamId && threadTs)) {
    return null
  }
  const slackPayload: Record<string, string> = {
    channelId,
    messageTs,
    teamId,
    threadTs,
  }
  const recipientUserId = readSlackUserId(message.externalUserId)
  if (recipientUserId) {
    slackPayload.recipientUserId = recipientUserId
  }
  return {
    concurrencyKey: slackConcurrencyKey({
      agentId,
      channelId,
      teamId,
      threadTs,
    }),
    idempotencyKey: slackIdempotencyKey({
      agentId,
      channelId,
      messageTs,
      teamId,
    }),
    payload: {
      slack: slackPayload,
    },
  }
}

function readString(
  value: Record<string, unknown> | undefined,
  key: string
): string {
  const item = value?.[key]
  return typeof item === 'string' ? item : ''
}

function readSlackUserId(value: string): string | null {
  const trimmed = value.trim()
  return trimmed && trimmed !== 'unknown' ? trimmed : null
}

// Channel adapters only want visible assistant text, so ignore non-text chunks here.
async function* chunksToTextIterable(
  readable: ReadableStream<UIMessageChunk>
): AsyncGenerator<string, void, unknown> {
  const reader = readable.getReader()
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) {
        return
      }
      if (!value || typeof value !== 'object') {
        continue
      }
      const chunk = value as { type?: string; delta?: unknown }
      if (chunk.type === 'text-delta' && typeof chunk.delta === 'string') {
        yield chunk.delta
      }
    }
  } finally {
    reader.releaseLock()
  }
}
