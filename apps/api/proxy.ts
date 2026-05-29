import {
  API_DEBUG_REQUEST_ID_HEADER,
  createApiDebugRequestId,
  getApiDebugHeaderSnapshot,
  logApiDebug,
} from '@outname/shared/server/api-debug'
import {
  getRelatedProjectOrigins,
  VERCEL_FRONTEND_PROJECT_IDENTIFIERS,
} from '@outname/shared/vercel-related-projects'
import { type NextRequest, NextResponse } from 'next/server'

const DEFAULT_LOCAL_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3002',
  'http://localhost:3003',
]

function configuredOrigins(): string[] {
  return [
    process.env.NEXT_PUBLIC_WEB_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_ADMIN_URL,
    process.env.BETTER_AUTH_URL,
    ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(',') ?? []),
    ...getRelatedProjectOrigins(VERCEL_FRONTEND_PROJECT_IDENTIFIERS),
    ...DEFAULT_LOCAL_ORIGINS,
  ]
    .map((origin) => origin?.trim())
    .filter((origin): origin is string => Boolean(origin))
}

function corsHeaders(origin: string): HeadersInit {
  return {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers':
      'authorization, content-type, x-requested-with',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Origin': origin,
    Vary: 'Origin',
  }
}

export function proxy(request: NextRequest) {
  const requestId = createApiDebugRequestId()
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(API_DEBUG_REQUEST_ID_HEADER, requestId)

  const origin = request.headers.get('origin')
  const allowedOrigins = configuredOrigins()
  const allowedOrigin =
    origin && allowedOrigins.includes(origin) ? origin : null

  logApiDebug('proxy:request', {
    allowedOrigin,
    configuredOriginCount: allowedOrigins.length,
    headers: getApiDebugHeaderSnapshot(request.headers),
    method: request.method,
    pathname: request.nextUrl.pathname,
    requestId,
  })

  if (request.method === 'OPTIONS') {
    logApiDebug('proxy:options-response', {
      method: request.method,
      pathname: request.nextUrl.pathname,
      requestId,
      status: allowedOrigin ? 204 : 403,
    })

    return new NextResponse(null, {
      headers: allowedOrigin ? corsHeaders(allowedOrigin) : undefined,
      status: allowedOrigin ? 204 : 403,
    })
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
  response.headers.set(API_DEBUG_REQUEST_ID_HEADER, requestId)
  if (allowedOrigin) {
    for (const [key, value] of Object.entries(corsHeaders(allowedOrigin))) {
      response.headers.set(key, value)
    }
  }
  return response
}

export const config = {
  matcher: ['/api/:path*'],
}
