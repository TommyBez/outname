'use client'

import { CheckIcon, CopyIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

const RESET_MS = 1600

export function CommandPill({
  command,
  copyText,
}: {
  command: string
  /** What actually lands on the clipboard; defaults to the shown command. */
  copyText?: string
}) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) {
      return
    }
    const timer = setTimeout(() => setCopied(false), RESET_MS)
    return () => clearTimeout(timer)
  }, [copied])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyText ?? command)
      setCopied(true)
    } catch {
      // Clipboard unavailable (e.g. insecure context); leave state unchanged.
    }
  }

  return (
    <div className="flex max-w-md items-center gap-3 border border-border bg-card py-1.5 pr-1.5 pl-4">
      <span className="font-mono text-muted-foreground text-sm">$</span>
      <span className="truncate font-mono text-foreground text-sm">
        {command}
      </span>
      <button
        aria-label={copied ? 'Copied' : 'Copy command'}
        className="ease ml-auto grid size-8 shrink-0 place-items-center text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
        onClick={handleCopy}
        type="button"
      >
        {copied ? (
          <CheckIcon className="size-4 text-brand" />
        ) : (
          <CopyIcon className="size-4" />
        )}
      </button>
    </div>
  )
}
