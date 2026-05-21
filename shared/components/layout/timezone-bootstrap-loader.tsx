import { TimezoneBootstrap } from '@/app/settings/timezone-bootstrap'
import { getSession } from '@/auth/server/auth-guard'
import { getUserTimezone } from '@/shared/server/user-timezone'

export async function TimezoneBootstrapLoader() {
  const session = await getSession()
  if (!session) {
    return null
  }
  const timezone = await getUserTimezone(session.user.id)
  return <TimezoneBootstrap timezone={timezone} userId={session.user.id} />
}
