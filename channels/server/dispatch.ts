import 'server-only'
import type { UIMessage, UIMessageChunk } from 'ai'
import { nanoid } from 'nanoid'
import { revalidateTag } from 'next/cache'
import { getRun } from 'workflow/api'
import { dispatchChatTurn } from '@/agent-runtime/server/session-events'
import { insertChatMessage } from '@/chat/server/chat'
import { conversationListTag } from '@/shared/server/cache-tags'
import {
  ensureConversationForThread,
  resolveAgentsForIncomingMessage,
} from './routing'
import type { ChannelReplySink, IncomingChannelMessage } from './types'

/**
 * Run chat turns for a non-web channel (Slack today, Teams / Discord
 * later). The shape mirrors the web `POST /api/agents/:id/chat`
 * handler, but fans out: a single inbound message can resolve to
 * multiple agents owned by different platform users (each user has
 * their own bindings against the same workspace).
 *
 * For each matched agent we:
 *   1. Find or create the underlying `chat_conversation` (per-agent).
 *   2. Persist the inbound user message before dispatching the
 *      workflow, so the human side of the transcript survives a
 *      workflow failure.
 *   3. Dispatch the chat turn into the agent session workflow.
 *   4. Subscribe to the per-turn UIMessage namespace and stream plain
 *      text chunks to the channel adapter.
 *
 * Replies are posted sequentially in the order the agents are
 * resolved so the sink (`thread.post`, etc.) sees one stream at a
 * time. Returns `false` when no agent is bound for the message;
 * callers should silently drop the event.
 */
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

    await insertChatMessage({
      conversationId: route.conversationId,
      id: userUiMessage.id,
      role: 'user',
      parts: userUiMessage.parts,
      metadata: userUiMessage.metadata,
    })
    revalidateTag(conversationListTag(agent.id), 'max')

    await sink.startTyping?.('Thinking...')

    const { sessionRunId, replyToken } = await dispatchChatTurn({
      agent,
      conversationId: route.conversationId,
      uiMessages: [userUiMessage],
    })

    const readable = getRun(sessionRunId).getReadable<UIMessageChunk>({
      namespace: replyToken,
    })

    const textIterable = chunksToTextIterable(readable)
    await sink.postReply(textIterable)
    handled = true
  }
  return handled
}

/**
 * Convert the agent session's UIMessage chunk stream into a plain text
 * stream suitable for chat surfaces.
 *
 * The session writes AI SDK `UIMessageChunk`s (`text-start`,
 * `text-delta`, `text-end`, `finish`, transient status parts, …). For a
 * chat surface we only care about the visible assistant text, so we
 * concatenate `text-delta`s from the latest assistant text part and
 * ignore everything else.
 */
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
