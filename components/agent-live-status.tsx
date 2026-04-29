'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { MorphingText } from '@/components/morphing-text'
import { useRunStream } from '@/hooks/use-run-stream'

/**
 * Compact single-line streaming status for the Today card.
 *
 * Subscribes to the run's NDJSON event stream and surfaces the most recent
 * step message. When the stream signals completion we refresh the parent
 * server component so the card transitions from "running" to "completed".
 */
export function AgentLiveStatus({ runId }: { runId: string }) {
  const router = useRouter()
  const { steps, status, connected } = useRunStream(runId)

  useEffect(() => {
    if (status === 'done' || status === 'failed') {
      const t = setTimeout(() => router.refresh(), 400)
      return () => clearTimeout(t)
    }
  }, [status, router])

  const activeStep = steps.find((s) => s.status === 'active')
  const lastDone = [...steps].reverse().find((s) => s.status === 'done')
  const source = activeStep ?? lastDone
  const message =
    source?.message ||
    source?.label ||
    (connected ? 'Waiting for the first step…' : 'Connecting…')

  return (
    <div className="flex min-w-0 items-center gap-3 text-sm">
      <span
        aria-hidden
        className="inline-block size-1.5 shrink-0 animate-pulse rounded-full bg-accent"
      />
      <span className="shrink-0 text-foreground">Running</span>
      <span aria-hidden className="shrink-0 text-muted-foreground">
        ·
      </span>
      <MorphingText
        className="min-w-0 truncate text-muted-foreground"
        text={message}
      />
    </div>
  )
}
