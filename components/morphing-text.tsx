'use client'

import { cn } from '@/lib/utils'

/**
 * Renders text with a blur + lift entrance animation every time the text
 * changes. Implemented by keying the inner span on the text itself, which
 * forces React to remount and replay the CSS keyframe.
 *
 * The outer span reserves layout so the headline doesn't jump as copy
 * morphs. Screen readers get the stable current text via `aria-live`.
 */
export function MorphingText({
  text,
  className,
  as: Tag = 'span',
}: {
  text: string
  className?: string
  as?: 'span' | 'p'
}) {
  return (
    <Tag
      aria-atomic="true"
      aria-live="polite"
      className={cn('relative block', className)}
    >
      <span
        className="inline-block animate-text-morph will-change-[transform,filter,opacity]"
        key={text}
      >
        {text}
      </span>
    </Tag>
  )
}
