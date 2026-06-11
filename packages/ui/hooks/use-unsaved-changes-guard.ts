'use client'

import { useEffect } from 'react'

/**
 * Warns before the browser unloads the page (refresh, tab close, external
 * navigation) while there are unsaved changes. In-app navigations should be
 * guarded at the action site (e.g. confirm on a Cancel button) since the App
 * Router has no cancellable route events.
 */
export function useUnsavedChangesGuard(hasUnsavedChanges: boolean) {
  useEffect(() => {
    if (!hasUnsavedChanges) {
      return
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])
}
