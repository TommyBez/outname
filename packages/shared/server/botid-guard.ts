import 'server-only'

import { BOTID_CHECK_LEVEL } from '@outname/shared/server/botid-config'
import { checkBotId } from 'botid/server'
import { NextResponse } from 'next/server'

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

function isBotIdCheckEnabled(): boolean {
  return process.env.BOTID_ENABLED === 'true'
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

export async function denyIfBot(
  request?: Request
): Promise<NextResponse | null> {
  if (!isBotIdCheckEnabled()) {
    return null
  }

  const extraAllowedHosts = getBotIdExtraAllowedHosts()
  const advancedOptions = {
    checkLevel: BOTID_CHECK_LEVEL,
    request,
    ...(extraAllowedHosts.length > 0 ? { extraAllowedHosts } : {}),
  }

  const verification = await checkBotId({
    advancedOptions,
  })

  if (verification.isBot) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  return null
}
