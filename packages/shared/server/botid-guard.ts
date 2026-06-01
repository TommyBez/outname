import 'server-only'

import { BOTID_CHECK_LEVEL } from '@outname/shared/server/botid-config'
import { checkBotId } from 'botid/server'
import { NextResponse } from 'next/server'

interface BotIdChallengeSnapshot {
  b?: unknown
  d?: unknown
}

function splitCommaSeparated(value: string | undefined): string[] {
  if (!value) {
    return []
  }

  return value.split(',').flatMap((entry) => {
    const trimmed = entry.trim()
    return trimmed ? [trimmed] : []
  })
}

function toHost(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  try {
    return new URL(trimmed).host
  } catch {
    // Continue with host-only values below.
  }

  try {
    return new URL(`https://${trimmed}`).host
  } catch {
    return null
  }
}

function getBotIdExtraAllowedHosts(): string[] {
  const hosts = new Set<string>()
  for (const value of [
    process.env.NEXT_PUBLIC_WEB_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    ...splitCommaSeparated(process.env.BETTER_AUTH_TRUSTED_ORIGINS),
  ]) {
    if (!value) {
      continue
    }
    const host = toHost(value)
    if (host) {
      hosts.add(host)
    }
  }
  return [...hosts]
}

function parseBotIdChallenge(
  value: string | null
): BotIdChallengeSnapshot | null {
  if (!value) {
    return null
  }

  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object') {
      return null
    }

    return parsed as BotIdChallengeSnapshot
  } catch {
    return null
  }
}

function getRequestPathname(request?: Request): string | undefined {
  if (!request) {
    return
  }

  try {
    return new URL(request.url).pathname
  } catch {
    return
  }
}

function logBotIdDenial(
  verification: Awaited<ReturnType<typeof checkBotId>>,
  request: Request | undefined,
  extraAllowedHosts: string[]
): void {
  const challenge = parseBotIdChallenge(
    request?.headers.get('x-is-human') ?? null
  )
  const classificationReason =
    'classificationReason' in verification
      ? verification.classificationReason
      : undefined
  const verifiedBotName =
    'verifiedBotName' in verification ? verification.verifiedBotName : undefined

  console.warn('[botid] request denied', {
    botId: {
      bypassed: verification.bypassed,
      challengeB: challenge?.b,
      challengeD: challenge?.d,
      checkLevel: BOTID_CHECK_LEVEL,
      classificationReason,
      isBot: verification.isBot,
      isHuman: verification.isHuman,
      isVerifiedBot: verification.isVerifiedBot,
      verifiedBotName,
    },
    headers: {
      hasXIsHuman: Boolean(request?.headers.get('x-is-human')),
      hasXMethod: Boolean(request?.headers.get('x-method')),
      hasXPath: Boolean(request?.headers.get('x-path')),
      xMethod: request?.headers.get('x-method'),
      xPath: request?.headers.get('x-path'),
    },
    request: {
      host: request?.headers.get('host'),
      method: request?.method,
      origin: request?.headers.get('origin'),
      pathname: getRequestPathname(request),
      referer: request?.headers.get('referer'),
      xForwardedHost: request?.headers.get('x-forwarded-host'),
    },
    extraAllowedHosts,
  })
}

export async function denyIfBot(
  request?: Request
): Promise<NextResponse | null> {
  const extraAllowedHosts = getBotIdExtraAllowedHosts()
  const advancedOptions = {
    checkLevel: BOTID_CHECK_LEVEL,
    ...(extraAllowedHosts.length > 0 ? { extraAllowedHosts } : {}),
  }

  const verification = await checkBotId({
    advancedOptions,
  })

  if (verification.isBot) {
    logBotIdDenial(verification, request, extraAllowedHosts)
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  return null
}
