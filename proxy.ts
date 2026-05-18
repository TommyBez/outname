import { getSessionCookie } from 'better-auth/cookies'
import { type NextRequest, NextResponse } from 'next/server'

export function proxy(req: NextRequest) {
  const sessionCookie = getSessionCookie(req)
  const { pathname } = req.nextUrl
  const isLoginPage = pathname === '/login'
  const isWaitlistPage = pathname.startsWith('/waitlist')
  const isWaitlistApi = pathname.startsWith('/api/waitlist')
  const isWaitlistRoute = isWaitlistPage || isWaitlistApi

  if (isWaitlistRoute) {
    if (process.env.WAITLIST_PUBLIC_ENABLED !== 'true') {
      if (isWaitlistApi) {
        return NextResponse.json({ error: 'not found' }, { status: 404 })
      }
      return new NextResponse('Not Found', { status: 404 })
    }
    return NextResponse.next()
  }

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
    '/waitlist/:path*',
    '/dashboard',
    '/settings/:path*',
    '/api/waitlist/:path*',
    '/api/workflow/:path*',
    '/api/agents/:path*',
  ],
}
