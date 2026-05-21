'use client'

import { useEffect, useRef } from 'react'
import { syncBrowserTimezoneAction } from '@/app/settings/actions'
import { getBrowserIanaTimeZone } from '@/shared/timezone-options'

const STORAGE_PREFIX = 'outname:tz-synced:'

export function TimezoneBootstrap({
  timezone,
  userId,
}: {
  timezone: string
  userId: string
}) {
  const started = useRef(false)

  useEffect(() => {
    if (started.current || timezone !== 'UTC') {
      return
    }
    const browserTimezone = getBrowserIanaTimeZone()
    if (!browserTimezone || browserTimezone === 'UTC') {
      return
    }
    const storageKey = `${STORAGE_PREFIX}${userId}`
    if (localStorage.getItem(storageKey)) {
      return
    }
    started.current = true
    syncBrowserTimezoneAction(browserTimezone).then((result) => {
      if (result.ok) {
        localStorage.setItem(storageKey, '1')
      }
    })
  }, [timezone, userId])

  return null
}
