import 'server-only'
import type { SlackAdapter } from '@chat-adapter/slack'
import type {
  IncomingChannelMessage,
  IncomingChannelTurn,
} from '@outname/shared/channels/server/types'
import type { Chat } from 'chat'
import {
  describeSlackAttachments,
  extractSlackTeamId,
  extractSlackThread,
  type SlackRawMessage,
} from './thread-ids'

export type SlackChat = Chat<{ slack: SlackAdapter }>
export type SlackThread = Parameters<
  Parameters<SlackChat['onNewMention']>[0]
>[0]
export type SlackMessage = Parameters<
  Parameters<SlackChat['onNewMention']>[0]
>[1]
export type SlackMessageContext = Parameters<
  Parameters<SlackChat['onNewMention']>[0]
>[2]

function extractTeamId(message: SlackMessage): string {
  const raw = message.raw as SlackRawMessage | undefined
  return extractSlackTeamId(raw)
}

export function buildIncomingSlackTurn(input: {
  thread: SlackThread
  message: SlackMessage
  kind: 'channel' | 'dm'
  providerHistory?: () => Promise<IncomingChannelMessage[]>
  skipped?: IncomingChannelMessage[]
}): IncomingChannelTurn | null {
  const { thread, message, kind } = input
  const raw = message.raw as SlackRawMessage | undefined
  const current = buildIncomingSlackMessage({ thread, message })
  if (!current) {
    return null
  }

  const slackThread = extractSlackThread(thread, raw)
  if (!slackThread) {
    console.warn('[slack] thread missing slack ids; skipping', {
      channelId: thread.channelId,
      threadId: thread.id,
    })
    return null
  }
  const { channelId, threadTs } = slackThread
  const messageTs = raw?.ts ?? threadTs

  const teamId = extractTeamId(message)
  if (!teamId) {
    console.warn(
      '[slack] dropping event with no team id; cannot owner-scope to an installation',
      { channelId }
    )
    return null
  }

  const routingKey =
    kind === 'dm' ? (message.author?.userId ?? channelId) : channelId

  return {
    channel: 'slack',
    current,
    externalScopeId: teamId,
    externalThreadId: thread.id,
    providerHistory: input.providerHistory,
    providerMetadata: {
      slackChannel: channelId,
      slackMessageTs: messageTs,
      slackThreadTs: threadTs,
      slackTeamId: teamId,
    },
    routing: {
      key: routingKey,
      kind,
    },
    skipped: input.skipped,
  }
}

export function buildIncomingSlackMessage(input: {
  thread: SlackThread
  message: SlackMessage
}): IncomingChannelMessage | null {
  const { thread, message } = input
  const raw = message.raw as SlackRawMessage | undefined
  const trimmedText = message.text?.trim() ?? ''
  const attachmentSummary = describeSlackAttachments(raw)
  if (!(trimmedText || attachmentSummary)) {
    return null
  }
  // Attachment-only messages still flow through routing/persistence as a text
  // summary in the canonical transcript.
  const text = trimmedText || `(attachment: ${attachmentSummary})`

  const slackThread = extractSlackThread(thread, raw)
  if (!slackThread) {
    console.warn('[slack] thread missing slack ids; skipping', {
      channelId: thread.channelId,
      threadId: thread.id,
    })
    return null
  }
  const { channelId, threadTs } = slackThread
  const messageTs = raw?.ts ?? threadTs

  const teamId = extractTeamId(message)

  return {
    createdAt: message.metadata.dateSent,
    externalMessageKey: message.id,
    externalUserId: message.author?.userId ?? 'unknown',
    externalUserDisplayName:
      message.author?.fullName ?? message.author?.userName,
    text,
    providerMetadata: {
      slackChannel: channelId,
      slackMessageTs: messageTs,
      slackThreadTs: threadTs,
      ...(teamId ? { slackTeamId: teamId } : {}),
    },
  }
}
