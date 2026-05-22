import { getSession } from '@/auth/server/auth-guard'
import { UserTimezoneProvider } from '@/shared/components/user-timezone-context'
import { DEFAULT_ACCOUNT_TIMEZONE } from '@/shared/format-timezone'
import { getUserTimezone } from '@/shared/server/user-timezone'

export async function UserTimezoneLoader({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  const timezone = session
    ? await getUserTimezone(session.user.id)
    : DEFAULT_ACCOUNT_TIMEZONE
  return (
    <UserTimezoneProvider timezone={timezone}>{children}</UserTimezoneProvider>
  )
}
