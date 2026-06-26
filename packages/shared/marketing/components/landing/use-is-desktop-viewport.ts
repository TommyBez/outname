'use client'

import { useSyncExternalStore } from 'react'

const LG_BREAKPOINT_PX = 1024

function subscribeDesktopViewport(onStoreChange: () => void) {
  const mql = window.matchMedia(`(min-width: ${LG_BREAKPOINT_PX}px)`)
  mql.addEventListener('change', onStoreChange)
  return () => mql.removeEventListener('change', onStoreChange)
}

function readDesktopViewport() {
  return window.matchMedia(`(min-width: ${LG_BREAKPOINT_PX}px)`).matches
}

function getServerDesktopViewport() {
  return false
}

export function useIsDesktopViewport() {
  return useSyncExternalStore(
    subscribeDesktopViewport,
    readDesktopViewport,
    getServerDesktopViewport
  )
}
