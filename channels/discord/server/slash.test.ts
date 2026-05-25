import { beforeEach, expect, test, vi } from 'vitest'
import { handleDiscordAgentSlashCommand, parseDiscordSlashRaw } from './slash'

vi.mock('server-only', () => ({}))

const mocks = vi.hoisted(() => ({
  discordBotFetch: vi.fn(async () => ({
    json: async () => ({ id: 'thread_1', name: 'Agent thread' }),
    ok: true,
  })),
  resolveRoutesForIncomingMessage: vi.fn(async () => [
    {
      agent: { id: 'agent_1' },
      installationCreatedAt: new Date(0),
      installationUserId: 'user_1',
    },
  ]),
  runChannelChatTurn: vi.fn(async () => true),
}))

vi.mock('next/server', () => ({
  after: (task: () => void | Promise<void>) => {
    task()
  },
}))

vi.mock('@/channels/server/dispatch', () => ({
  runChannelChatTurn: mocks.runChannelChatTurn,
}))

vi.mock('@/channels/server/routing', () => ({
  resolveRoutesForIncomingMessage: mocks.resolveRoutesForIncomingMessage,
}))

vi.mock('./api', () => ({
  DiscordApiError: class DiscordApiError extends Error {
    readonly body: string
    readonly status: number

    constructor(message: string, status: number, body: string) {
      super(message)
      this.body = body
      this.status = status
    }
  },
  discordBotFetch: mocks.discordBotFetch,
  readDiscordJson: async (response: { json: () => Promise<unknown> }) =>
    response.json(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

test('parseDiscordSlashRaw extracts guild, channel, thread parent, and user', () => {
  expect(
    parseDiscordSlashRaw({
      channel: {
        parent_id: 'parent_1',
        type: 11,
      },
      channel_id: 'thread_1',
      guild_id: 'guild_1',
      id: 'interaction_1',
      member: {
        user: {
          global_name: 'Ada',
          id: 'user_1',
          username: 'ada',
        },
      },
    })
  ).toEqual({
    channelId: 'thread_1',
    channelType: 11,
    guildId: 'guild_1',
    interactionId: 'interaction_1',
    parentChannelId: 'parent_1',
    userDisplayName: 'Ada',
    userId: 'user_1',
    userName: 'ada',
  })
})

test('concurrent slash retries with same interaction id create one starter, thread, and run', async () => {
  let lockAcquired = false
  const setIfNotExists = vi.fn(() => {
    if (lockAcquired) {
      return Promise.resolve(false)
    }
    lockAcquired = true
    return Promise.resolve(true)
  })
  const subscribe = vi.fn(async () => undefined)
  const threadPost = vi.fn(async () => undefined)
  const bot = {
    getState: () => ({ setIfNotExists }),
    thread: vi.fn(() => ({
      allMessages: [],
      id: 'discord:guild_1:channel_1:thread_1',
      post: threadPost,
      startTyping: vi.fn(async () => undefined),
      subscribe,
    })),
  }
  const adapter = {
    encodeThreadId: vi.fn(({ channelId, guildId, threadId }) =>
      ['discord', guildId, channelId, threadId].filter(Boolean).join(':')
    ),
  }
  const channelPost = vi.fn(async () => ({ id: 'starter_1' }))
  const event = {
    channel: {
      id: 'discord:guild_1:channel_1',
      post: channelPost,
    },
    command: '/agent',
    raw: {
      channel: { type: 0 },
      channel_id: 'channel_1',
      guild_id: 'guild_1',
      id: 'interaction_1',
      member: {
        user: {
          id: 'user_1',
          username: 'ada',
        },
      },
    },
    text: 'ship it',
  }

  await Promise.all([
    handleDiscordAgentSlashCommand({
      adapter: adapter as never,
      bot: bot as never,
      event: event as never,
    }),
    handleDiscordAgentSlashCommand({
      adapter: adapter as never,
      bot: bot as never,
      event: event as never,
    }),
  ])
  await Promise.resolve()

  expect(setIfNotExists).toHaveBeenCalledTimes(2)
  expect(channelPost).toHaveBeenCalledTimes(1)
  expect(mocks.discordBotFetch).toHaveBeenCalledTimes(1)
  expect(subscribe).toHaveBeenCalledTimes(1)
  expect(mocks.runChannelChatTurn).toHaveBeenCalledTimes(1)
})
