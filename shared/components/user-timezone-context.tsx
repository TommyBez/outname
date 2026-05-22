'use client'

import { createContext, useContext } from 'react'
import { DEFAULT_ACCOUNT_TIMEZONE } from '@/shared/format-timezone'

const UserTimezoneContext = createContext<string | null>(null)

export function UserTimezoneProvider({
  children,
  timezone,
}: {
  children: React.ReactNode
  timezone: string
}) {
  return (
    <UserTimezoneContext.Provider value={timezone}>
      {children}
    </UserTimezoneContext.Provider>
  )
}

export function useUserTimezone(): string {
  return useContext(UserTimezoneContext) ?? DEFAULT_ACCOUNT_TIMEZONE
}
