import type { UIMessageChunk } from 'ai'
import { getRun } from 'workflow/api'
import { getSlackAdapter, getSlackBot } from './bot'

export async function forwardSlackStreamToThread(input: {
  channelId: string
  eventId: string
  replyNamespace: string
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

  await adapter.withBotToken(install.botToken, async () => {
    const thread = bot.thread(`slack:${input.channelId}:${input.threadTs}`)
    const readable = getRun(input.workflowRunId).getReadable<UIMessageChunk>({
      namespace: input.replyNamespace,
      startIndex: 0,
    })
    await thread.post(chunksToTextIterable(readable))
  })
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
