import { checkAdminAccessFromHeaders } from '@outname/auth/server/admin-access'
import type { Session } from '@outname/auth/server/auth'
import { headers as nextHeaders } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { NextResponse } from 'next/server'

export type AdminRequestResult =
  | { ok: true; session: Session }
  | { ok: false; response: NextResponse }

export async function requireAdminAccess(): Promise<Session> {
  const access = await checkAdminAccessFromHeaders(await nextHeaders())

  if (access.status === 'unauthenticated') {
    redirect('/login')
  }

  if (access.status === 'forbidden') {
    notFound()
  }

  return access.session
}

export async function requireAdminRequest(
  request: Request
): Promise<AdminRequestResult> {
  const access = await checkAdminAccessFromHeaders(request.headers)

  if (access.status === 'unauthenticated') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  if (access.status === 'forbidden') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Not found' }, { status: 404 }),
    }
  }

  return { ok: true, session: access.session }
}
