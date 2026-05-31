'use client'
import { cn } from '@outname/ui/lib/utils'
import {
  AnimatePresence,
  type AnimatePresenceProps,
  domAnimation,
  LazyMotion,
  m,
  type Transition,
  type Variants,
} from 'motion/react'
import { Children, useEffect, useState } from 'react'

export interface TextLoopProps {
  children: React.ReactNode[]
  className?: string
  interval?: number
  mode?: AnimatePresenceProps['mode']
  onIndexChange?: (index: number) => void
  transition?: Transition
  trigger?: boolean
  variants?: Variants
}

const DEFAULT_TRANSITION: Transition = { duration: 0.3 }
const DEFAULT_MOTION_VARIANTS: Variants = {
  initial: { y: 20, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: -20, opacity: 0 },
}

export function TextLoop({
  children,
  className,
  interval = 2,
  transition = DEFAULT_TRANSITION,
  variants,
  onIndexChange,
  trigger = true,
  mode = 'popLayout',
}: TextLoopProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const items = Children.toArray(children)

  useEffect(() => {
    if (!trigger) {
      return
    }

    const intervalMs = interval * 1000
    const timer = setInterval(() => {
      setCurrentIndex((current) => {
        const next = (current + 1) % items.length
        onIndexChange?.(next)
        return next
      })
    }, intervalMs)
    return () => clearInterval(timer)
  }, [items.length, interval, onIndexChange, trigger])

  if (items.length === 0) {
    return null
  }

  return (
    <span className={cn('relative inline-block whitespace-nowrap', className)}>
      <LazyMotion features={domAnimation}>
        <AnimatePresence initial={false} mode={mode}>
          <m.span
            animate="animate"
            className="inline-block"
            exit="exit"
            initial="initial"
            key={currentIndex}
            transition={transition}
            variants={variants ?? DEFAULT_MOTION_VARIANTS}
          >
            {items[currentIndex]}
          </m.span>
        </AnimatePresence>
      </LazyMotion>
    </span>
  )
}
