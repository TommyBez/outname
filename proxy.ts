import { getSessionCookie } from 'better-auth/cookies'
import { type NextRequest, NextResponse } from 'next/server'

export function proxy(req: NextRequest) {
  const sessionCookie = getSessionCookie(req)
  const { pathname } = req.nextUrl
  const isLoginPage = pathname === '/login'

  if (sessionCookie && isLoginPage) {
    const url = req.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }

  if (isLoginPage) {
    return NextResponse.next()
  }

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
    '/login',
    '/dashboard',
    '/settings/:path*',
    '/api/workflow/:path*',
    '/api/agents/:path*',
  ],
}
