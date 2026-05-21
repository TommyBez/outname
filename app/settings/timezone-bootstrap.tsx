'use client'

import { useEffect, useRef } from 'react'
import { syncBrowserTimezoneAction } from '@/app/settings/actions'
import { getBrowserIanaTimeZone } from '@/shared/timezone-options'

const STORAGE_PREFIX = 'outname:tz-synced:'

function isLocalStorageAvailable(): boolean {
  return (
    typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
  )
}

function readTimezoneBootstrapFlag(key: string): string | null {
  if (!isLocalStorageAvailable()) {
    return null
  }
  try {
    return localStorage.getItem(key)
  } catch (error) {
    console.error(
      'Failed to read timezone bootstrap flag from localStorage',
      error
    )
    return null
  }
}

function writeTimezoneBootstrapFlag(key: string, value: string): void {
  if (!isLocalStorageAvailable()) {
    return
  }
  try {
    localStorage.setItem(key, value)
  } catch (error) {
    console.error(
      'Failed to write timezone bootstrap flag to localStorage',
      error
    )
  }
}

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
    if (readTimezoneBootstrapFlag(storageKey)) {
      return
    }
    started.current = true
    syncBrowserTimezoneAction(browserTimezone)
      .then((result) => {
        if (result.ok) {
          writeTimezoneBootstrapFlag(storageKey, '1')
        }
      })
      .catch((error) => {
        console.error('Failed to sync browser timezone', error)
      })
  }, [timezone, userId])

  return null
}
