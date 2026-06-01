'use client'

import { type RefObject, useLayoutEffect, useState } from 'react'

export interface ElementSize {
  height: number
  width: number
}

export function useElementSize(
  ref: RefObject<HTMLElement | null>
): ElementSize | null {
  const [size, setSize] = useState<ElementSize | null>(null)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) {
      return
    }

    const readSize = () => {
      const width = element.clientWidth
      const height = element.clientHeight
      if (width <= 0 && height <= 0) {
        return
      }
      setSize({ width: width || 320, height: height || 272 })
    }

    readSize()

    if (typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver(() => {
      readSize()
    })
    observer.observe(element)

    return () => observer.disconnect()
  }, [ref])

  return size
}
