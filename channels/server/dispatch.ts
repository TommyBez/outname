import 'server-only'
import { createHash } from 'node:crypto'
import { convertToModelMessages, type ModelMessage, type UIMessage } from 'ai'
import { revalidateTag } from 'next/cache'
import { runRealtimeChatTurn } from '@/agent-runtime/server/realtime-chat-runner'
import { insertChatMessageIfNew } from '@/chat/server/chat'
import { conversationListTag } from '@/shared/server/cache-tags'
import {
  ensureConversationForThread,
  resolveRoutesForIncomingMessage,
} from './routing'
import type { ChannelReplySink, IncomingChannelMessage } from './types'

// One inbound channel message can fan out to multiple user-owned agents bound
// to the same workspace. Fan-out is intentionally sequential and sorted by
// installation.createdAt, installation.userId, then agent.id in routing.
export async function runChannelChatTurn(input: {
  message: IncomingChannelMessage
  sink: ChannelReplySink
}): Promise<boolean> {
  const { message, sink } = input

  const resolvedRoutes = await resolveRoutesForIncomingMessage(message)
  if (resolvedRoutes.length === 0) {
    return false
  }

  let handled = false
  for (const resolved of resolvedRoutes) {
    const { agent } = resolved
    if (!agent.enabled) {
      await sink.postError(
        `Agent "${agent.name}" is paused. Enable it from the dashboard before sending more messages.`
      )
      handled = true
      continue
    }

    const route = await ensureConversationForThread({
      agent,
      installationCreatedAt: resolved.installationCreatedAt,
      installationUserId: resolved.installationUserId,
      message,
    })
    const skippedTurns = (message.skipped ?? []).map((skipped) => ({
      message: skipped,
      userUiMessage: buildUserUiMessage({
        agentId: agent.id,
        message: skipped,
      }),
    }))
    for (const skippedTurn of skippedTurns) {
      await persistUserMessage({
        conversationId: route.conversationId,
        message: skippedTurn.message,
        userUiMessage: skippedTurn.userUiMessage,
      })
    }
    const skippedUserMessages = skippedTurns.map((turn) => turn.userUiMessage)

    const userUiMessage = buildUserUiMessage({
      agentId: agent.id,
      message,
    })
    const inserted = await persistUserMessage({
      conversationId: route.conversationId,
      message,
      userUiMessage,
    })
    if (!inserted) {
      handled = true
      continue
    }
    revalidateTag(conversationListTag(agent.id), 'max')

    await sink.startTyping?.('Thinking...')

    const modelMessages = await loadModelMessagesForTurn({
      fallbackMessages: [...skippedUserMessages, userUiMessage],
      message,
    })

    try {
      await runRealtimeChatTurn({
        abortSignal: AbortSignal.timeout(240_000),
        agentId: agent.id,
        assistantMessageId: `msg_${crypto.randomUUID()}`,
        conversationId: route.conversationId,
        delivery: {
          postAgentStream: sink.postAgentStream,
          postText: sink.postText,
          scheduleBackgroundTask: sink.scheduleBackgroundTask,
        },
        messages: modelMessages,
        persistMode: 'text-only',
        runId: `rt_${crypto.randomUUID()}`,
        source: message.channel,
        titleMessages: [...skippedUserMessages, userUiMessage],
        userId: agent.userId,
      })
    } catch (error) {
      handled = true
      console.error('[channels] realtime agent turn failed', {
        agentId: agent.id,
        channel: message.channel,
        conversationId: route.conversationId,
        error,
        externalThreadKey: message.externalThreadKey,
      })
      await postAgentFailureNotice({
        agentName: agent.name,
        sink,
      })
      continue
    }
    handled = true
  }
  return handled
}

async function postAgentFailureNotice(input: {
  agentName: string
  sink: ChannelReplySink
}): Promise<void> {
  try {
    await input.sink.postError(
      `Agent "${input.agentName}" failed while processing this message. Continuing with the remaining agents.`
    )
  } catch (error) {
    console.error('[channels] failed to post agent failure notice', {
      agentName: input.agentName,
      error,
    })
  }
}

function buildUserUiMessage(input: {
  agentId: string
  message: IncomingChannelMessage
}): UIMessage {
  const { agentId, message } = input
  return {
    id: channelUserMessageId({ agentId, message }),
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
}

async function persistUserMessage(input: {
  conversationId: string
  message: IncomingChannelMessage
  userUiMessage: UIMessage
}): Promise<boolean> {
  return await insertChatMessageIfNew({
    conversationId: input.conversationId,
    createdAt: channelMessageCreatedAt(input.message),
    id: input.userUiMessage.id,
    role: 'user',
    parts: input.userUiMessage.parts,
    metadata: input.userUiMessage.metadata,
  })
}

async function loadModelMessagesForTurn(input: {
  fallbackMessages: UIMessage[]
  message: IncomingChannelMessage
}): Promise<ModelMessage[]> {
  const loaded = await input.message.loadModelMessages?.()
  if (loaded) {
    return loaded
  }
  return await convertToModelMessages(input.fallbackMessages)
}

function channelUserMessageId(input: {
  agentId: string
  message: IncomingChannelMessage
}): string {
  if (input.message.channel === 'slack') {
    const rawKey = [
      input.message.channel,
      input.message.teamId,
      slackExternalMessageKey(input.message),
      input.agentId,
    ].join('\u0000')
    return `msg_${createHash('sha256')
      .update(rawKey)
      .digest('base64url')
      .slice(0, 16)}`
  }
  return `msg_${crypto.randomUUID()}`
}

function slackExternalMessageKey(message: IncomingChannelMessage): string {
  const channelId = readString(message.threadMetadata, 'slackChannel')
  const messageTs = readString(message.threadMetadata, 'slackMessageTs')
  return `${channelId}:${messageTs}`
}

function channelMessageCreatedAt(
  message: IncomingChannelMessage
): Date | undefined {
  if (message.channel !== 'slack') {
    return
  }
  const messageTs = readString(message.threadMetadata, 'slackMessageTs')
  return parseSlackTs(messageTs)
}

export function parseSlackTs(ts: string): Date {
  const [secondsValue, micros = '0'] = ts.split('.')
  const seconds = Number(secondsValue)
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return new Date()
  }
  const paddedMicros = Number(micros.padEnd(6, '0'))
  if (!Number.isFinite(paddedMicros) || paddedMicros < 0) {
    return new Date()
  }
  const ms = seconds * 1000 + Math.floor(paddedMicros / 1000)
  return new Date(ms)
}

function readString(
  value: Record<string, unknown> | undefined,
  key: string
): string {
  const item = value?.[key]
  return typeof item === 'string' ? item : ''
}
