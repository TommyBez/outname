import { slackIntegrationPermission } from '@outname/auth/access-control'
import { auth } from '@outname/auth/server/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

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

export async function hasSlackIntegrationAccess(
  userId: string
): Promise<boolean> {
  const permission = await auth.api.userHasPermission({
    body: {
      userId,
      permissions: slackIntegrationPermission,
    },
  })
  return permission.success
}

/**
 * Convenience wrapper for handlers and Server Actions that only need
 * the authenticated user's id. Redirects to /login if no session.
 */
export async function requireUserId(): Promise<string> {
  const session = await requireSession()
  return session.user.id
}
