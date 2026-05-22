import 'server-only'
import { createHash } from 'node:crypto'
import { convertToModelMessages, type UIMessage } from 'ai'
import { revalidateTag } from 'next/cache'
import { runRealtimeChatTurn } from '@/agent-runtime/server/realtime-chat-runner'
import {
  type ChatMessageWriteResult,
  loadChatHistory,
  upsertChatMessage,
} from '@/chat/server/chat'
import { conversationListTag } from '@/shared/server/cache-tags'
import {
  ensureConversationForThread,
  resolveRoutesForIncomingMessage,
} from './routing'
import type {
  ChannelReplySink,
  IncomingChannelMessage,
  IncomingChannelTurn,
} from './types'

// One inbound channel message can fan out to multiple user-owned agents bound
// to the same workspace. Fan-out is intentionally sequential and sorted by
// installation.createdAt, installation.userId, then agent.id in routing.
export async function runChannelChatTurn(input: {
  turn: IncomingChannelTurn
  sink: ChannelReplySink
}): Promise<boolean> {
  const { sink, turn } = input
  const loadProviderHistory = memoizeProviderHistory(turn.providerHistory)

  const resolvedRoutes = await resolveRoutesForIncomingMessage(turn)
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
      message: turn,
    })
    const currentAndSkippedKeys = new Set([
      turn.current.externalMessageKey,
      ...(turn.skipped ?? []).map((message) => message.externalMessageKey),
    ])
    const providerHistory = (await loadProviderHistory()).filter(
      (historyMessage) =>
        !currentAndSkippedKeys.has(historyMessage.externalMessageKey)
    )
    await importUserMessages({
      agentId: agent.id,
      conversationId: route.conversationId,
      messages: providerHistory,
      turn,
    })
    await importUserMessages({
      agentId: agent.id,
      conversationId: route.conversationId,
      messages: turn.skipped ?? [],
      turn,
    })

    const userUiMessage = buildUserUiMessage({
      agentId: agent.id,
      message: turn.current,
      turn,
    })
    const currentWrite = await persistUserMessage({
      conversationId: route.conversationId,
      message: turn.current,
      userUiMessage,
    })
    if (currentWrite === 'unchanged') {
      handled = true
      continue
    }
    revalidateTag(conversationListTag(agent.id), 'max')

    await sink.startTyping?.('Thinking...')

    const canonicalHistory = await loadChatHistory(route.conversationId)
    const modelMessages = await convertToModelMessages(canonicalHistory)

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
        externalScopeId: turn.externalScopeId,
        externalThreadId: turn.externalThreadId,
        messages: modelMessages,
        persistMode: 'text-only',
        runId: `rt_${crypto.randomUUID()}`,
        source: turn.channel,
        titleMessages: canonicalHistory,
        userId: agent.userId,
      })
    } catch (error) {
      handled = true
      console.error('[channels] realtime agent turn failed', {
        agentId: agent.id,
        channel: turn.channel,
        conversationId: route.conversationId,
        error,
        externalScopeId: turn.externalScopeId,
        externalThreadId: turn.externalThreadId,
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
  turn: IncomingChannelTurn
}): UIMessage {
  const { agentId, message, turn } = input
  return {
    id: channelUserMessageId({ agentId, message, turn }),
    role: 'user',
    parts: [{ type: 'text', text: message.text }],
    metadata: {
      channel: turn.channel,
      externalScopeId: turn.externalScopeId,
      externalUserId: message.externalUserId,
      externalUserDisplayName: message.externalUserDisplayName ?? null,
      externalThreadId: turn.externalThreadId,
      providerMetadata: message.providerMetadata ?? null,
      source: turn.channel,
    },
  }
}

async function importUserMessages(input: {
  agentId: string
  conversationId: string
  messages: IncomingChannelMessage[]
  turn: IncomingChannelTurn
}): Promise<void> {
  for (const message of input.messages) {
    await persistUserMessage({
      conversationId: input.conversationId,
      message,
      userUiMessage: buildUserUiMessage({
        agentId: input.agentId,
        message,
        turn: input.turn,
      }),
    })
  }
}

async function persistUserMessage(input: {
  conversationId: string
  message: IncomingChannelMessage
  userUiMessage: UIMessage
}): Promise<ChatMessageWriteResult> {
  return await upsertChatMessage({
    conversationId: input.conversationId,
    createdAt: input.message.createdAt,
    id: input.userUiMessage.id,
    role: 'user',
    parts: input.userUiMessage.parts,
    metadata: input.userUiMessage.metadata,
  })
}

function memoizeProviderHistory(
  providerHistory: IncomingChannelTurn['providerHistory']
): () => Promise<IncomingChannelMessage[]> {
  if (!providerHistory) {
    return async () => []
  }

  let promise: Promise<IncomingChannelMessage[]> | null = null
  return async () => {
    promise ??= providerHistory().catch((error) => {
      console.warn('[channels] failed to import provider history', { error })
      return []
    })
    return await promise
  }
}

function channelUserMessageId(input: {
  agentId: string
  message: IncomingChannelMessage
  turn: IncomingChannelTurn
}): string {
  if (input.message.externalMessageKey.trim().length === 0) {
    throw new Error(
      'channelUserMessageId: input.message.externalMessageKey must be non-empty'
    )
  }
  const rawKey = [
    input.turn.channel,
    input.turn.externalScopeId,
    input.message.externalMessageKey,
    input.agentId,
  ].join('\u0000')
  return `msg_${createHash('sha256')
    .update(rawKey)
    .digest('base64url')
    .slice(0, 16)}`
}
