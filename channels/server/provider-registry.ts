import 'server-only'

import type { NextRequest } from 'next/server'
import type { Session } from '@/auth/server/auth'
import { discordChannelProvider } from '@/channels/discord/server/provider'
import { slackChannelProvider } from '@/channels/slack/server/provider'
import type { ChannelId } from './types'

export interface ChannelProvider {
  channel: ChannelId
  handleOAuthCallback(request: NextRequest, session: Session): Promise<Response>
  isConfigured(): boolean
  missingConfigMessage(): string
  startInstall(
    request: NextRequest,
    session: Session
  ): Promise<Response> | Response
}

export const channelProviders: Record<ChannelId, ChannelProvider> = {
  discord: discordChannelProvider,
  slack: slackChannelProvider,
}

export function isChannelId(value: string): value is ChannelId {
  return value === 'discord' || value === 'slack'
}

export function getChannelProvider(channel: ChannelId): ChannelProvider {
  return channelProviders[channel]
}
