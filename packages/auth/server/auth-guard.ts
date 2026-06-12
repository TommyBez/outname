import {
  slackIntegrationPermission,
  waitlistManagePermission,
} from '@outname/auth/access-control'
import { auth } from '@outname/auth/server/auth'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { cache } from 'react'

/**
 * Deduplicated per request: layouts, pages, and nested server components can
 * all await the session without repeating the lookup.
 */
export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() })
)

export async function requireSession() {
  const session = await getSession()
  if (!session) {
    redirect('/login')
  }
  return session
}

export async function hasWaitlistManageAccess(
  userId: string
): Promise<boolean> {
  const permission = await auth.api.userHasPermission({
    body: {
      userId,
      permissions: waitlistManagePermission,
    },
  })
  return permission.success
}

export async function requireWaitlistManageAccess() {
  const session = await requireSession()
  if (!(await hasWaitlistManageAccess(session.user.id))) {
    notFound()
  }
  return session
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
