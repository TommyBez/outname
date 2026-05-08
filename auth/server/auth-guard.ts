import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/auth/server/auth'

export async function requireSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })
  if (!session) {
    redirect('/login')
  }
  return session
}

export async function getSession() {
  return auth.api.getSession({ headers: await headers() })
}

/**
 * Convenience wrapper for handlers and Server Actions that only need
 * the authenticated user's id. Redirects to /login if no session.
 */
export async function requireUserId(): Promise<string> {
  const session = await requireSession()
  return session.user.id
}
