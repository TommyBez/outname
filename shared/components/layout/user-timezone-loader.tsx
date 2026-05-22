import { getSession } from '@/auth/server/auth-guard'
import { UserTimezoneProvider } from '@/shared/components/user-timezone-context'
import { getUserTimezone } from '@/shared/server/user-timezone'

export async function UserTimezoneLoader({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session) {
    return children
  }
  const timezone = await getUserTimezone(session.user.id)
  return (
    <UserTimezoneProvider timezone={timezone}>{children}</UserTimezoneProvider>
  )
}
