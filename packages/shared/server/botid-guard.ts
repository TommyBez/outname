import 'server-only'

import { getRelatedProjectOrigins } from '@outname/shared/vercel-related-projects'
import { checkBotId } from 'botid/server'
import { NextResponse } from 'next/server'

function splitCommaSeparated(value: string | undefined): string[] {
  if (!value) {
    return []
  }

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
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
  return [
    process.env.NEXT_PUBLIC_WEB_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_ADMIN_URL,
    ...splitCommaSeparated(process.env.BETTER_AUTH_TRUSTED_ORIGINS),
    ...getRelatedProjectOrigins(),
  ].reduce<string[]>((hosts, value) => {
    if (!value) {
      return hosts
    }

    const host = toHost(value)
    if (host && !hosts.includes(host)) {
      hosts.push(host)
    }

    return hosts
  }, [])
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
