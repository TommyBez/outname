import 'server-only'
import type { SlackAdapter } from '@chat-adapter/slack'
import type { ModelMessage } from 'ai'
import type { Chat } from 'chat'
import type { IncomingChannelMessage } from '@/channels/server/types'
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

// Top-level messages use their own ts so direct replies still round-trip as a
// stable synthetic thread.
function slackThreadKey(channel: string, threadTs: string): string {
  return `${channel}:${threadTs}`
}

function extractTeamId(message: SlackMessage): string {
  const raw = message.raw as SlackRawMessage | undefined
  return extractSlackTeamId(raw)
}

export function buildIncomingSlackMessage(input: {
  thread: SlackThread
  message: SlackMessage
  kind: 'channel' | 'dm'
  loadModelMessages?: () => Promise<ModelMessage[] | undefined>
}): IncomingChannelMessage | null {
  const { thread, message, kind } = input
  const raw = message.raw as SlackRawMessage | undefined
  const trimmedText = message.text?.trim() ?? ''
  const attachmentSummary = describeSlackAttachments(raw)
  if (!(trimmedText || attachmentSummary)) {
    return null
  }
  // Attachment-only messages still flow through routing/persistence; the model
  // receives the actual file bytes via `toAiMessages` in `loadModelMessages`.
  const text = trimmedText || `(attachment: ${attachmentSummary})`

  // Keep provider-native Slack ids out of routing keys; `slack:`-prefixed SDK
  // ids should not leak into shared channel bindings.
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
      { channelId, kind }
    )
    return null
  }

  const externalRoutingKey =
    kind === 'dm' ? (message.author?.userId ?? channelId) : channelId

  return {
    channel: 'slack',
    createdAt: message.metadata.dateSent,
    externalMessageKey: message.id,
    externalThreadKey: slackThreadKey(channelId, threadTs),
    externalRoutingKey,
    externalRoutingKind: kind,
    externalUserId: message.author?.userId ?? 'unknown',
    externalUserDisplayName:
      message.author?.fullName ?? message.author?.userName,
    teamId,
    text,
    threadMetadata: {
      slackChannel: channelId,
      slackMessageTs: messageTs,
      slackThreadTs: threadTs,
      slackTeamId: teamId,
    },
    loadModelMessages: input.loadModelMessages,
  }
}
