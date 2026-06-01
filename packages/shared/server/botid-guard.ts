import 'server-only'

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
  _request?: Request
): Promise<NextResponse | null> {
  const extraAllowedHosts = getBotIdExtraAllowedHosts()

  const verification =
    extraAllowedHosts.length > 0
      ? await checkBotId({
          advancedOptions: {
            extraAllowedHosts,
          },
        })
      : await checkBotId()

  if (verification.isBot) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  return null
}
