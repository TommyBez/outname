import 'server-only'
import { getCachedUserTimezone } from '@outname/shared/server/user-timezone'
import {
  createUserTimeDisplay,
  type UserTimeDisplay,
} from '@outname/shared/user-time-display'
import { cache } from 'react'

export const getUserTimeDisplay = cache(
  async (userId: string): Promise<UserTimeDisplay> => {
    const timeZone = await getCachedUserTimezone(userId)
    return createUserTimeDisplay(timeZone)
  }
)
