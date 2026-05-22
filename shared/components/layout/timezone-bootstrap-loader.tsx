import { TimezoneBootstrap } from '@/app/settings/timezone-bootstrap'
import { getSession } from '@/auth/server/auth-guard'
import { getUserTimezoneBootstrapState } from '@/shared/server/user-timezone'

export async function TimezoneBootstrapLoader() {
  const session = await getSession()
  if (!session) {
    return null
  }
  const state = await getUserTimezoneBootstrapState(session.user.id)
  return <TimezoneBootstrap allowAutoSync={state.allowAutoSync} />
}
