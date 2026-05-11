export interface SlackRawMessage {
  channel?: string
  team?: string
  team_id?: string
  thread_ts?: string
  ts?: string
}

interface SlackThreadRef {
  channelId: string
  id: string
}

const SLACK_ID_PREFIX = 'slack:'

export function extractSlackTeamId(
  raw: Pick<SlackRawMessage, 'team' | 'team_id'> | undefined
): string {
  return raw?.team_id ?? raw?.team ?? ''
}

function normalizeSlackThread(thread: SlackThreadRef): {
  channelId: string
  threadTs: string
} | null {
  const channelId = thread.channelId.startsWith(SLACK_ID_PREFIX)
    ? thread.channelId.slice(SLACK_ID_PREFIX.length)
    : thread.channelId
  if (!channelId) {
    return null
  }

  const encodedPrefix = `${SLACK_ID_PREFIX}${channelId}:`
  const threadTs = thread.id.startsWith(encodedPrefix)
    ? thread.id.slice(encodedPrefix.length)
    : thread.id
  if (!threadTs) {
    return null
  }

  return { channelId, threadTs }
}

export function extractSlackThread(
  thread: SlackThreadRef,
  raw: SlackRawMessage | undefined
): {
  channelId: string
  threadTs: string
} | null {
  const channelId = raw?.channel?.trim()
  const threadTs = raw?.thread_ts ?? raw?.ts ?? ''

  // Prefer provider-native ids from the raw Slack event. This keeps the
  // shared routing layer independent from Chat SDK serialization details
  // and gives top-level messages a stable `channel:ts` thread key.
  if (channelId && threadTs) {
    return { channelId, threadTs }
  }

  return normalizeSlackThread(thread)
}
