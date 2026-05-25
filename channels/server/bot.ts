import 'server-only'
import {
  createDiscordAdapter,
  type DiscordAdapter,
} from '@chat-adapter/discord'
import { createSlackAdapter, type SlackAdapter } from '@chat-adapter/slack'
import { type Adapter, Chat } from 'chat'
import { registerDiscordHandlers } from '@/channels/discord/server/handlers'
import { registerSlackHandlers } from '@/channels/slack/server/handlers'
import type { SlackChat } from '@/channels/slack/server/incoming-message'
import { ChannelHybridState } from './state'
import type { ChannelId } from './types'

interface ChannelsBotBundle {
  adapters: Partial<{
    discord: DiscordAdapter
    slack: SlackAdapter
  }>
  bot: Chat<Record<string, Adapter>>
}

let cachedBundle: ChannelsBotBundle | null = null
let buildPromise: Promise<ChannelsBotBundle> | null = null

export function isChannelConfigured(channel: ChannelId): boolean {
  if (channel === 'slack') {
    return Boolean(
      process.env.SLACK_CLIENT_ID &&
        process.env.SLACK_CLIENT_SECRET &&
        process.env.SLACK_SIGNING_SECRET
    )
  }
  return Boolean(
    process.env.DISCORD_APPLICATION_ID &&
      process.env.DISCORD_BOT_TOKEN &&
      process.env.DISCORD_PUBLIC_KEY
  )
}

export async function getChannelsBot(): Promise<Chat<Record<string, Adapter>>> {
  return (await ensureBundle()).bot
}

export async function getSlackAdapter(): Promise<SlackAdapter> {
  const adapter = (await ensureBundle()).adapters.slack
  if (!adapter) {
    throw new Error(
      'Slack is not configured. Set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET.'
    )
  }
  return adapter
}

export async function getDiscordAdapter(): Promise<DiscordAdapter> {
  const adapter = (await ensureBundle()).adapters.discord
  if (!adapter) {
    throw new Error(
      'Discord is not configured. Set DISCORD_APPLICATION_ID, DISCORD_BOT_TOKEN, and DISCORD_PUBLIC_KEY.'
    )
  }
  return adapter
}

async function ensureBundle(): Promise<ChannelsBotBundle> {
  if (cachedBundle) {
    return cachedBundle
  }
  buildPromise ??= Promise.resolve()
    .then(buildBundle)
    .catch((error) => {
      buildPromise = null
      throw error
    })
  cachedBundle = await buildPromise
  return cachedBundle
}

function buildBundle(): ChannelsBotBundle {
  const channelUserName = process.env.CHANNEL_BOT_USERNAME ?? 'assistant'
  const adapters: Record<string, Adapter> = {}
  const typedAdapters: ChannelsBotBundle['adapters'] = {}

  const slackClientId = process.env.SLACK_CLIENT_ID
  const slackClientSecret = process.env.SLACK_CLIENT_SECRET
  const slackSigningSecret = process.env.SLACK_SIGNING_SECRET
  if (slackClientId && slackClientSecret && slackSigningSecret) {
    const slack = createSlackAdapter({
      clientId: slackClientId,
      clientSecret: slackClientSecret,
      signingSecret: slackSigningSecret,
      userName: process.env.SLACK_BOT_USERNAME ?? channelUserName,
    })
    adapters.slack = slack
    typedAdapters.slack = slack
  }

  const discordApplicationId = process.env.DISCORD_APPLICATION_ID
  const discordBotToken = process.env.DISCORD_BOT_TOKEN
  const discordPublicKey = process.env.DISCORD_PUBLIC_KEY
  if (discordApplicationId && discordBotToken && discordPublicKey) {
    const discord = createDiscordAdapter({
      applicationId: discordApplicationId,
      botToken: discordBotToken,
      mentionRoleIds: parseDiscordMentionRoleIds(),
      publicKey: discordPublicKey,
      userName: process.env.DISCORD_BOT_USERNAME ?? channelUserName,
    })
    adapters.discord = discord
    typedAdapters.discord = discord
  }

  if (Object.keys(adapters).length === 0) {
    throw new Error(
      'No channel adapters are configured. Configure Slack or Discord environment variables.'
    )
  }

  const bot = new Chat({
    adapters,
    concurrency: {
      maxQueueSize: 10,
      onQueueFull: 'drop-oldest',
      queueEntryTtlMs: 300_000,
      strategy: 'queue',
    },
    dedupeTtlMs: 600_000,
    fallbackStreamingPlaceholderText: null,
    state: new ChannelHybridState(),
    userName: channelUserName,
  })

  if (typedAdapters.slack) {
    registerSlackHandlers(bot as unknown as SlackChat)
  }
  if (typedAdapters.discord) {
    registerDiscordHandlers({
      adapter: typedAdapters.discord,
      bot: bot as unknown as Chat<{ discord: DiscordAdapter }>,
    })
  }

  return { adapters: typedAdapters, bot }
}

function parseDiscordMentionRoleIds(): string[] | undefined {
  const raw = process.env.DISCORD_MENTION_ROLE_IDS
  if (!raw) {
    return
  }
  const values = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  return values.length > 0 ? values : undefined
}
