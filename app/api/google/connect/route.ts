import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth-guard'
import { buildAuthorizeUrl, getRedirectUri } from '@/lib/google-oauth'

export async function GET(req: Request) {
  await requireSession()

  const state = crypto.randomUUID()
  const jar = await cookies()
  jar.set('google_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  const redirectUri = getRedirectUri(req.url)
  const authorizeUrl = buildAuthorizeUrl(state, redirectUri)
  return NextResponse.redirect(authorizeUrl)
}
