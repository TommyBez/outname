import { checkAdminAccessFromHeaders } from '@outname/auth/server/admin-access'
import { type NextRequest, NextResponse } from 'next/server'

const LOGIN_PATH = '/login'
const NOT_FOUND_RESPONSE = 'Not Found'

function getInternalPathWithSearch(request: NextRequest): string {
  const { pathname, search } = request.nextUrl
  return `${pathname}${search}`
}

function getSafeRedirectPath(value: string | null): string {
  if (!(value?.startsWith('/') && !value.startsWith('//'))) {
    return '/'
  }

  const url = new URL(value, 'http://admin.local')
  if (url.pathname === LOGIN_PATH) {
    return '/'
  }

  return `${url.pathname}${url.search}`
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const access = await checkAdminAccessFromHeaders(request.headers)

  if (pathname === LOGIN_PATH) {
    if (access.status === 'ok') {
      const redirectPath = getSafeRedirectPath(
        request.nextUrl.searchParams.get('from')
      )
      return NextResponse.redirect(new URL(redirectPath, request.url))
    }

    return NextResponse.next()
  }

  if (access.status === 'unauthenticated') {
    const url = request.nextUrl.clone()
    url.pathname = LOGIN_PATH
    url.search = ''
    url.searchParams.set('from', getInternalPathWithSearch(request))
    return NextResponse.redirect(url)
  }

  if (access.status === 'forbidden') {
    return new NextResponse(NOT_FOUND_RESPONSE, { status: 404 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|icon.svg|favicon.ico|.*\\..*).*)',
  ],
}
