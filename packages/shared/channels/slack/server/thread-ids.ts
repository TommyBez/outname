export interface SlackRawFile {
  filetype?: string
  id?: string
  mimetype?: string
  name?: string
  permalink?: string
  title?: string
  url_private?: string
}

export interface SlackRawMessage {
  channel?: string
  files?: SlackRawFile[]
  team?: string
  team_id?: string
  thread_ts?: string
  ts?: string
}

// Returns a comma-separated list like `image.png (image/png), report.pdf` so
// attachment-only Slack messages can still produce a non-empty routable text
// for the chat pipeline. Empty string when there is nothing to describe.
export function describeSlackAttachments(
  raw: SlackRawMessage | undefined
): string {
  const files = raw?.files
  if (!Array.isArray(files) || files.length === 0) {
    return ''
  }
  const entries: string[] = []
  for (const file of files) {
    const name = file.name?.trim() || file.title?.trim() || 'attachment'
    const mime = file.mimetype?.trim()
    entries.push(mime ? `${name} (${mime})` : name)
  }
  return entries.join(', ')
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
