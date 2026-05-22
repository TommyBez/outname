import 'server-only'
import { cache } from 'react'
import { getCachedUserTimezone } from '@/shared/server/user-timezone'
import {
  createUserTimeDisplay,
  type UserTimeDisplay,
} from '@/shared/user-time-display'

export const getUserTimeDisplay = cache(
  async (userId: string): Promise<UserTimeDisplay> => {
    const timeZone = await getCachedUserTimezone(userId)
    return createUserTimeDisplay(timeZone)
  }
)
