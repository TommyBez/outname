'use client'

import { useEffect, useState } from 'react'

const CHAR_MS = 26
const NEWLINE_MS = 240

export function HeroTerminal({
  lines,
  shouldReduceMotion,
}: {
  lines: readonly string[]
  shouldReduceMotion: boolean
}) {
  const text = lines.join('\n')
  const [count, setCount] = useState(shouldReduceMotion ? text.length : 0)

  useEffect(() => {
    if (shouldReduceMotion || count >= text.length) {
      return
    }
    const delay = text[count] === '\n' ? NEWLINE_MS : CHAR_MS
    const timer = setTimeout(() => setCount((current) => current + 1), delay)
    return () => clearTimeout(timer)
  }, [count, shouldReduceMotion, text])

  const typing = count < text.length
  const shownLines = text.slice(0, count).split('\n')

  return (
    <div
      className="border border-border bg-foreground p-4 font-mono text-background text-xs leading-relaxed"
      style={{ minHeight: `${lines.length * 1.5 + 2}rem` }}
    >
      {shownLines.map((line, index) => {
        const isLast = index === shownLines.length - 1
        const key = index
        return (
          <p className="truncate" key={key}>
            {line || ' '}
            {isLast && typing ? (
              <span
                aria-hidden
                className="ml-0.5 inline-block h-[1em] w-[0.5em] animate-cursor-blink bg-brand align-middle"
              />
            ) : null}
          </p>
        )
      })}
    </div>
  )
}
