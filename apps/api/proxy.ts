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
    ...DEFAULT_LOCAL_ORIGINS,
  ]
    .map((origin) => origin?.trim())
    .filter((origin): origin is string => Boolean(origin))
}

function corsHeaders(origin: string): HeadersInit {
  return {
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers':
      'authorization, content-type, x-requested-with',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-origin': origin,
    vary: 'Origin',
  }
}

export function proxy(request: NextRequest) {
  const origin = request.headers.get('origin')
  const allowedOrigin =
    origin && configuredOrigins().includes(origin) ? origin : null

  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      headers: allowedOrigin ? corsHeaders(allowedOrigin) : undefined,
      status: allowedOrigin ? 204 : 403,
    })
  }

  const response = NextResponse.next()
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
