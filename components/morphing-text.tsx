"use client"

import { cn } from "@/lib/utils"

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
  as: Tag = "span",
}: {
  text: string
  className?: string
  as?: "span" | "p"
}) {
  return (
    <Tag
      className={cn("relative block", className)}
      aria-live="polite"
      aria-atomic="true"
    >
      <span
        key={text}
        className="animate-text-morph inline-block will-change-[transform,filter,opacity]"
      >
        {text}
      </span>
    </Tag>
  )
}
