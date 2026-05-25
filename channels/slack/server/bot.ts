import 'server-only'

import type { SlackAdapter } from '@chat-adapter/slack'
import type { Chat } from 'chat'
import {
  getChannelsBot,
  getSlackAdapter as getSharedSlackAdapter,
} from '@/channels/server/bot'
import type { SlackChat } from './incoming-message'

export async function getSlackBot(): Promise<SlackChat> {
  return (await getChannelsBot()) as unknown as SlackChat
}

export async function getSlackAdapter(): Promise<SlackAdapter> {
  return await getSharedSlackAdapter()
}

export type SlackBot = Chat<{ slack: SlackAdapter }>
