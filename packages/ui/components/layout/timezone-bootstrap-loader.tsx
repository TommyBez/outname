import { getSession } from '@outname/auth/server/auth-guard'
import { getUserTimezoneBootstrapState } from '@outname/shared/server/user-timezone'
import { TimezoneBootstrap } from './timezone-bootstrap'

export async function TimezoneBootstrapLoader() {
  const session = await getSession()
  if (!session) {
    return null
  }
  const state = await getUserTimezoneBootstrapState(session.user.id)
  return <TimezoneBootstrap allowAutoSync={state.allowAutoSync} />
}
