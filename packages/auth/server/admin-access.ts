import { waitlistManagePermission } from '@outname/auth/access-control'
import { auth, type Session } from '@outname/auth/server/auth'

export type AdminAccessResult =
  | { session: Session; status: 'ok' }
  | { status: 'unauthenticated' }
  | { status: 'forbidden' }

export async function checkAdminAccessFromHeaders(
  headers: Headers
): Promise<AdminAccessResult> {
  const session = await auth.api.getSession({ headers })
  if (!session) {
    return { status: 'unauthenticated' }
  }

  const permission = await auth.api.userHasPermission({
    body: {
      permissions: waitlistManagePermission,
      userId: session.user.id,
    },
  })

  if (!permission.success) {
    return { status: 'forbidden' }
  }

  return { session, status: 'ok' }
}
