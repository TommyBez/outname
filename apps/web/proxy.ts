import { type NextRequest, NextResponse } from 'next/server'

export function proxy(req: NextRequest) {
  if (process.env.WAITLIST_PUBLIC_ENABLED === 'true') {
    return NextResponse.next()
  }

  const { pathname } = req.nextUrl
  if (pathname.startsWith('/waitlist')) {
    return new NextResponse('Not Found', { status: 404 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/waitlist/:path*'],
}
