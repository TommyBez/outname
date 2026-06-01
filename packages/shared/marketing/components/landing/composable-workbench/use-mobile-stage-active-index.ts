'use client'

import { type RefObject, useEffect, useRef, useSyncExternalStore } from 'react'
import { mostVisibleStageIndex } from './constants'

type Listener = () => void

function createStageIndexStore(initialIndex: number) {
  let index = initialIndex
  const listeners = new Set<Listener>()

  return {
    getIndex: () => index,
    setIndex: (next: number) => {
      if (index === next) {
        return
      }
      index = next
      for (const listener of listeners) {
        listener()
      }
    },
    subscribe: (listener: Listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export function useMobileStageActiveIndex(
  stageRefs: RefObject<Array<HTMLElement | null>>
) {
  const storeRef = useRef(createStageIndexStore(0))
  const store = storeRef.current

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      return
    }

    const stageVisibility = new Map<number, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = Number((entry.target as HTMLElement).dataset.stageIndex)
          if (Number.isNaN(index)) {
            continue
          }
          stageVisibility.set(
            index,
            entry.isIntersecting ? entry.intersectionRatio : 0
          )
        }

        const nextIndex = mostVisibleStageIndex(stageVisibility)
        if (nextIndex !== null) {
          store.setIndex(nextIndex)
        }
      },
      {
        rootMargin: '-42% 0px -28% 0px',
        threshold: [0.25, 0.4, 0.55, 0.7, 0.85],
      }
    )

    for (const [index, node] of stageRefs.current.entries()) {
      if (!node) {
        continue
      }
      stageVisibility.set(index, 0)
      observer.observe(node)
    }

    return () => observer.disconnect()
  }, [stageRefs, store])

  return useSyncExternalStore(store.subscribe, store.getIndex, () => 0)
}
