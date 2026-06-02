import { BOTID_PROTECTED_ROUTES } from '@outname/shared/server/botid-config'
import { initBotId } from 'botid/client/core'

initBotId({
  protect: [...BOTID_PROTECTED_ROUTES],
})
