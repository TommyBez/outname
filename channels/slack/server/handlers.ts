import 'server-only'
import type { StreamEvent } from 'chat'
import { after } from 'next/server'
import { runChannelChatTurn } from '@/channels/server/dispatch'
import type { IncomingChannelMessage } from '@/channels/server/types'
import {
  buildIncomingSlackMessage,
  buildIncomingSlackTurn,
  type SlackChat,
  type SlackMessage,
  type SlackMessageContext,
  type SlackThread,
} from './incoming-message'

export function registerSlackHandlers(bot: SlackChat): void {
  bot.onNewMention(async (thread, message, context) => {
    if (!isSlackThread(thread)) {
      return
    }
    await thread.subscribe()
    await handleSlackMessage({ thread, message, kind: 'channel', context })
  })

  bot.onDirectMessage(async (thread, message, _channel, context) => {
    if (!isSlackThread(thread)) {
      return
    }
    await thread.subscribe()
    await handleSlackMessage({ thread, message, kind: 'dm', context })
  })

  bot.onSubscribedMessage(async (thread, message, context) => {
    if (!isSlackThread(thread)) {
      return
    }
    await handleSlackMessage({
      thread,
      message,
      kind: thread.isDM ? 'dm' : 'channel',
      context,
    })
  })
}

function isSlackThread(thread: SlackThread): boolean {
  return thread.id.startsWith('slack:')
}

async function handleSlackMessage(input: {
  thread: SlackThread
  message: SlackMessage
  kind: 'channel' | 'dm'
  context?: SlackMessageContext
}): Promise<void> {
  const { thread, message, kind, context } = input
  const skipped = (context?.skipped ?? [])
    .map((skipped) =>
      buildIncomingSlackMessage({
        thread,
        message: skipped as SlackMessage,
      })
    )
    .filter((skipped): skipped is IncomingChannelMessage => Boolean(skipped))
  const incoming = buildIncomingSlackTurn({
    thread,
    message,
    kind,
    providerHistory: () => collectThreadHistory(thread),
    skipped,
  })
  if (!incoming) {
    return
  }

  const handled = await runChannelChatTurn({
    turn: incoming,
    sink: {
      postAgentStream: async (stream) => {
        await thread.post(stream as AsyncIterable<string | StreamEvent>)
      },
      postText: async (text) => {
        await thread.post(text)
      },
      postError: async (errorText) => {
        await thread.post(errorText)
      },
      scheduleBackgroundTask(task) {
        after(task)
      },
      startTyping: async (status) => {
        await thread.startTyping(status)
      },
    },
  })

  if (!handled) {
    console.warn('[slack] no agent binding for incoming message', {
      externalScopeId: incoming.externalScopeId,
      externalThreadId: incoming.externalThreadId,
      kind,
      routingKey: incoming.routing.key,
    })
  }
}

async function collectThreadHistory(
  thread: SlackThread
): Promise<IncomingChannelMessage[]> {
  try {
    const messages: IncomingChannelMessage[] = []
    for await (const m of thread.allMessages) {
      if (m.author?.isMe || m.author?.isBot === true) {
        continue
      }
      const incoming = buildIncomingSlackMessage({
        thread,
        message: m as SlackMessage,
      })
      if (incoming) {
        messages.push(incoming)
      }
    }
    return messages
  } catch (err) {
    console.warn('[slack] failed to import thread history; falling back', {
      err: err instanceof Error ? err.message : String(err),
      threadId: thread.id,
    })
    return []
  }
}
