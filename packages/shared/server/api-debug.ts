export const API_DEBUG_REQUEST_ID_HEADER = 'x-outname-api-debug-id'

const API_DEBUG_LOG_PREFIX = '[api-debug]'
const USER_AGENT_MAX_LENGTH = 160

function parseCookieNames(cookieHeader: string | null): string[] {
  if (!cookieHeader) {
    return []
  }

  return cookieHeader
    .split(';')
    .map((cookie) => cookie.split('=')[0]?.trim())
    .filter((name): name is string => Boolean(name))
}

function getHeaderLength(headers: Headers, name: string): number {
  return headers.get(name)?.length ?? 0
}

function getTruncatedHeader(headers: Headers, name: string): string | null {
  const value = headers.get(name)
  if (!value) {
    return null
  }

  return value.slice(0, USER_AGENT_MAX_LENGTH)
}

export function shouldLogApiDebug(): boolean {
  return (
    process.env.API_DEBUG_LOGS === 'true' ||
    process.env.VERCEL_ENV === 'preview' ||
    process.env.NODE_ENV !== 'production'
  )
}

export function createApiDebugRequestId(): string {
  return crypto.randomUUID()
}

export function getApiDebugRequestId(headers: Headers): string {
  return headers.get(API_DEBUG_REQUEST_ID_HEADER) ?? createApiDebugRequestId()
}

export function getApiDebugHeaderSnapshot(headers: Headers) {
  return {
    authorizationPresent: headers.has('authorization'),
    botId: {
      xIsHumanLength: getHeaderLength(headers, 'x-is-human'),
      xIsHumanPresent: headers.has('x-is-human'),
      xMethod: headers.get('x-method'),
      xPath: headers.get('x-path'),
    },
    contentType: headers.get('content-type'),
    cookieNames: parseCookieNames(headers.get('cookie')),
    cors: {
      accessControlRequestHeaders: headers.get(
        'access-control-request-headers'
      ),
      accessControlRequestMethod: headers.get('access-control-request-method'),
      origin: headers.get('origin'),
      referer: headers.get('referer'),
    },
    headerNames: [...headers.keys()].sort(),
    host: {
      forwardedHost: headers.get('x-forwarded-host'),
      forwardedProto: headers.get('x-forwarded-proto'),
      host: headers.get('host'),
    },
    userAgent: getTruncatedHeader(headers, 'user-agent'),
    vercel: {
      deploymentUrl: headers.get('x-vercel-deployment-url'),
      forwardedForPresent: headers.has('x-forwarded-for'),
      id: headers.get('x-vercel-id'),
      ipCountry: headers.get('x-vercel-ip-country'),
      oidcTokenPresent: headers.has('x-vercel-oidc-token'),
    },
  }
}

export function logApiDebug(
  event: string,
  details: Record<string, unknown>
): void {
  if (!shouldLogApiDebug()) {
    return
  }

  console.warn(`${API_DEBUG_LOG_PREFIX} ${event}`, details)
}
