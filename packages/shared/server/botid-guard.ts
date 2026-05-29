import 'server-only'

import {
  API_DEBUG_REQUEST_ID_HEADER,
  createApiDebugRequestId,
  getApiDebugHeaderSnapshot,
  getApiDebugRequestId,
  logApiDebug,
} from '@outname/shared/server/api-debug'
import {
  getRelatedProjectOrigins,
  VERCEL_FRONTEND_PROJECT_IDENTIFIERS,
} from '@outname/shared/vercel-related-projects'
import { checkBotId } from 'botid/server'
import { NextResponse } from 'next/server'

type BotIdVerification = Awaited<ReturnType<typeof checkBotId>>

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
    ...getRelatedProjectOrigins(VERCEL_FRONTEND_PROJECT_IDENTIFIERS),
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

function getVerificationDebugPayload(verification: BotIdVerification) {
  const payload: Record<string, unknown> = {
    bypassed: verification.bypassed,
    isBot: verification.isBot,
    isHuman: verification.isHuman,
    isVerifiedBot: verification.isVerifiedBot,
  }

  if ('classificationReason' in verification) {
    payload.classificationReason = verification.classificationReason ?? null
  }

  if ('verifiedBotCategory' in verification) {
    payload.verifiedBotCategory = verification.verifiedBotCategory ?? null
  }

  if ('verifiedBotName' in verification) {
    payload.verifiedBotName = verification.verifiedBotName ?? null
  }

  return payload
}

export async function denyIfBot(
  request?: Request
): Promise<NextResponse | null> {
  const requestId = request
    ? getApiDebugRequestId(request.headers)
    : createApiDebugRequestId()
  const extraAllowedHosts = getBotIdExtraAllowedHosts()

  logApiDebug('botid:before-check', {
    extraAllowedHostCount: extraAllowedHosts.length,
    extraAllowedHosts,
    headers: request ? getApiDebugHeaderSnapshot(request.headers) : null,
    requestId,
  })

  let verification: BotIdVerification
  try {
    verification =
      extraAllowedHosts.length > 0
        ? await checkBotId({
            advancedOptions: {
              extraAllowedHosts,
            },
          })
        : await checkBotId()
  } catch (error) {
    logApiDebug('botid:check-error', {
      error:
        error instanceof Error
          ? { message: error.message, name: error.name, stack: error.stack }
          : String(error),
      requestId,
    })
    throw error
  }

  logApiDebug('botid:after-check', {
    requestId,
    verification: getVerificationDebugPayload(verification),
  })

  if (verification.isBot) {
    logApiDebug('botid:blocked', {
      requestId,
      verification: getVerificationDebugPayload(verification),
    })

    const response = NextResponse.json(
      { error: 'Access denied' },
      { status: 403 }
    )
    response.headers.set(API_DEBUG_REQUEST_ID_HEADER, requestId)
    return response
  }

  return null
}
