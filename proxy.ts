import { getSessionCookie } from 'better-auth/cookies'
import { type NextRequest, NextResponse } from 'next/server'

export function proxy(req: NextRequest) {
  const sessionCookie = getSessionCookie(req)
  const { pathname } = req.nextUrl

  if (!sessionCookie) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('from', pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/',
    '/runs/:path*',
    '/settings/:path*',
    '/api/workflow/:path*',
    '/api/runs/:path*',
  ],
}
