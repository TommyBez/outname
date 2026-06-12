'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

const REFRESH_INTERVAL_MS = 7000

/**
 * Re-fetches the server-rendered dashboard while events are in flight so
 * statuses, budgets, and the attention queue stay current without a manual
 * reload. Pauses when the tab is hidden.
 */
export function DashboardAutoRefresh({ enabled }: { enabled: boolean }) {
  const router = useRouter()

  useEffect(() => {
    if (!enabled) {
      return
    }
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        router.refresh()
      }
    }, REFRESH_INTERVAL_MS)
    return () => window.clearInterval(intervalId)
  }, [enabled, router])

  return null
}
