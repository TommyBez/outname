'use client'

import { useEffect, useRef } from 'react'
import { syncBrowserTimezoneAction } from '@/app/settings/actions'
import { getBrowserIanaTimeZone } from '@/shared/timezone-options'

export function TimezoneBootstrap({
  allowAutoSync,
}: {
  allowAutoSync: boolean
}) {
  const started = useRef(false)

  useEffect(() => {
    if (started.current || !allowAutoSync) {
      return
    }
    const browserTimezone = getBrowserIanaTimeZone()
    if (!browserTimezone || browserTimezone === 'UTC') {
      return
    }
    started.current = true
    syncBrowserTimezoneAction(browserTimezone, 'auto').catch((error) => {
      console.error('Failed to sync browser timezone', error)
    })
  }, [allowAutoSync])

  return null
}
