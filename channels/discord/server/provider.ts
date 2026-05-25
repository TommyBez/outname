import 'server-only'

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Session } from '@/auth/server/auth'
import { isChannelConfigured } from '@/channels/server/bot'
import type { ChannelProvider } from '@/channels/server/provider-registry'
import { DISCORD_API_BASE_URL, discordBotFetch, readDiscordJson } from './api'
import { ensureDiscordAgentCommand } from './commands'
import { saveDiscordInstallation } from './installations'
import {
  decodeDiscordOAuthState,
  encodeDiscordOAuthState,
  normalizeDiscordOAuthReturnTo,
} from './oauth-state'

const DISCORD_AUTHORIZE_URL = 'https://discord.com/oauth2/authorize'
const DEFAULT_BOT_PERMISSIONS = '309237678080'
const TRAILING_SLASH = /\/$/

const discordTokenSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().min(1),
})

const discordUserSchema = z.object({
  global_name: z.string().nullable().optional(),
  id: z.string().min(1),
  username: z.string().min(1).optional(),
})

const discordGuildSchema = z.object({
  id: z.string().min(1),
  name: z.string().nullable().optional(),
})

export const discordChannelProvider: ChannelProvider = {
  channel: 'discord',
  async handleOAuthCallback(request, session) {
    return await handleDiscordOAuthCallback(request, session)
  },
  isConfigured() {
    return Boolean(
      isChannelConfigured('discord') && process.env.DISCORD_CLIENT_SECRET
    )
  },
  missingConfigMessage() {
    return 'Discord is not configured. Set DISCORD_APPLICATION_ID, DISCORD_BOT_TOKEN, DISCORD_PUBLIC_KEY, and DISCORD_CLIENT_SECRET.'
  },
  startInstall(request, session) {
    return startDiscordInstall(request, session)
  },
}

function startDiscordInstall(request: NextRequest, session: Session): Response {
  const returnTo = normalizeDiscordOAuthReturnTo(
    request.nextUrl.searchParams.get('returnTo')
  )
  const applicationId = process.env.DISCORD_APPLICATION_ID
  if (!applicationId) {
    return redirectToChannels(
      request,
      {
        connection: 'error',
        reason: discordChannelProvider.missingConfigMessage(),
      },
      returnTo
    )
  }

  const state = encodeDiscordOAuthState({
    returnTo,
    userId: session.user.id,
  })
  const params = new URLSearchParams({
    client_id: applicationId,
    permissions: process.env.DISCORD_BOT_PERMISSIONS ?? DEFAULT_BOT_PERMISSIONS,
    redirect_uri: channelCallbackUrl('discord'),
    response_type: 'code',
    scope: 'identify bot applications.commands',
    state,
  })

  return NextResponse.redirect(`${DISCORD_AUTHORIZE_URL}?${params.toString()}`)
}

async function handleDiscordOAuthCallback(
  request: NextRequest,
  session: Session
): Promise<Response> {
  const url = new URL(request.url)
  const stateParam = url.searchParams.get('state')
  const decoded = stateParam ? decodeDiscordOAuthState(stateParam) : null
  const returnTo = decoded?.userId === session.user.id ? decoded.returnTo : null
  const error = url.searchParams.get('error')
  if (error) {
    return redirectToChannels(
      request,
      {
        connection: 'error',
        reason: `discord: ${error}`,
      },
      returnTo
    )
  }
  if (!stateParam) {
    return redirectToChannels(request, {
      connection: 'error',
      reason: 'missing state',
    })
  }
  if (!decoded) {
    return redirectToChannels(request, {
      connection: 'error',
      reason: 'invalid state',
    })
  }
  if (decoded.userId !== session.user.id) {
    return redirectToChannels(request, {
      connection: 'error',
      reason: 'state does not match session user',
    })
  }

  const code = url.searchParams.get('code')
  const guildId = url.searchParams.get('guild_id')
  const permissions = url.searchParams.get('permissions')
  if (!(code && guildId)) {
    return redirectToChannels(
      request,
      {
        connection: 'error',
        reason: 'Discord callback is missing code or guild_id.',
      },
      returnTo
    )
  }

  try {
    const token = await exchangeDiscordCode(code)
    const discordUser = await fetchDiscordUser(token.access_token)
    const guild = await fetchBotGuild(guildId)
    const commandVersion = await ensureDiscordAgentCommand(guild.id)
    await saveDiscordInstallation({
      agentCommandVersion: commandVersion,
      discordUserId: discordUser.id,
      discordUserName: discordUser.global_name ?? discordUser.username ?? null,
      guildId: guild.id,
      guildName: guild.name ?? null,
      permissions,
      userId: session.user.id,
    })

    return redirectToChannels(
      request,
      {
        connection: 'connected',
        provider: 'discord',
      },
      returnTo
    )
  } catch (err) {
    console.error('[discord-oauth] callback failed', err)
    return redirectToChannels(
      request,
      {
        connection: 'error',
        reason: err instanceof Error ? err.message : 'discord oauth failed',
      },
      returnTo
    )
  }
}

async function exchangeDiscordCode(
  code: string
): Promise<z.infer<typeof discordTokenSchema>> {
  const applicationId = process.env.DISCORD_APPLICATION_ID
  const clientSecret = process.env.DISCORD_CLIENT_SECRET
  if (!(applicationId && clientSecret)) {
    throw new Error(
      'DISCORD_APPLICATION_ID and DISCORD_CLIENT_SECRET are required for Discord OAuth.'
    )
  }

  const body = new URLSearchParams({
    client_id: applicationId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: channelCallbackUrl('discord'),
  })
  const response = await fetch(`${DISCORD_API_BASE_URL}/oauth2/token`, {
    body,
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    method: 'POST',
  })
  if (!response.ok) {
    throw new Error(`Discord token exchange failed (${response.status}).`)
  }
  return discordTokenSchema.parse(await response.json())
}

async function fetchDiscordUser(
  accessToken: string
): Promise<z.infer<typeof discordUserSchema>> {
  const response = await fetch(`${DISCORD_API_BASE_URL}/users/@me`, {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  })
  if (!response.ok) {
    throw new Error(`Discord user lookup failed (${response.status}).`)
  }
  return discordUserSchema.parse(await response.json())
}

async function fetchBotGuild(
  guildId: string
): Promise<z.infer<typeof discordGuildSchema>> {
  const response = await discordBotFetch(`/guilds/${guildId}`)
  return discordGuildSchema.parse(await readDiscordJson<unknown>(response))
}

function channelCallbackUrl(channel: string): string {
  const baseUrl = process.env.BETTER_AUTH_URL
  if (!baseUrl) {
    throw new Error('BETTER_AUTH_URL must be set to build OAuth redirect URIs.')
  }
  return `${baseUrl.replace(TRAILING_SLASH, '')}/api/channels/${channel}/oauth/callback`
}

function redirectToChannels(
  request: NextRequest,
  params: Record<string, string>,
  returnTo: string | null = null
): Response {
  const target = new URL(returnTo ?? '/channels', request.url)
  for (const [key, value] of Object.entries(params)) {
    target.searchParams.set(key, value)
  }
  return NextResponse.redirect(target)
}
