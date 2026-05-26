import { initBotId } from 'botid/client/core'
import { BOTID_PROTECTED_ROUTES } from '@/shared/server/botid-config'

initBotId({
  protect: [...BOTID_PROTECTED_ROUTES],
})
