import 'server-only'
import { cache } from 'react'
import {
  createUserTimeDisplay,
  type UserTimeDisplay,
} from '@/shared/user-time-display'
import { getCachedUserTimezone } from '@/shared/server/user-timezone'

export const getUserTimeDisplay = cache(
  async (userId: string): Promise<UserTimeDisplay> => {
    const timeZone = await getCachedUserTimezone(userId)
    return createUserTimeDisplay(timeZone)
  }
)
