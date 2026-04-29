'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import useSWR from 'swr'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

interface StatusResp {
  completedAt: string | null
  error: string | null
  liveStatus: string | null
  runId: string
  startedAt: string
  status: 'running' | 'completed' | 'failed'
}

const fetcher = (url: string) =>
  fetch(url).then((r) => r.json() as Promise<StatusResp>)

const LABEL: Record<StatusResp['status'], string> = {
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
}

function statusDotClassName(
  status: 'running' | 'completed' | 'failed'
): string {
  if (status === 'running') {
    return 'bg-accent animate-pulse'
  }
  if (status === 'completed') {
    return 'bg-foreground/50'
  }
  return 'bg-destructive'
}

export function RunStatus({
  runId,
  initialStatus,
  showTime = true,
}: {
  runId: string
  initialStatus: 'running' | 'completed' | 'failed'
  showTime?: boolean
}) {
  const router = useRouter()
  const { data } = useSWR(`/api/runs/${runId}/status`, fetcher, {
    refreshInterval: initialStatus === 'running' ? 3000 : 0,
    fallbackData: undefined,
  })
  const status = data?.status ?? initialStatus

  useEffect(() => {
    if (initialStatus === 'running' && status !== 'running') {
      router.refresh()
    }
  }, [status, initialStatus, router])

  const dot = statusDotClassName(status)

  const tone = status === 'failed' ? 'text-destructive' : 'text-foreground'

  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span
        aria-hidden
        className={cn('inline-block size-1.5 rounded-full', dot)}
      />
      <span className={tone}>{LABEL[status]}</span>
      {showTime && status !== 'running' && data?.completedAt && (
        <span className="text-muted-foreground">
          · {formatRelative(data.completedAt)}
        </span>
      )}
    </span>
  )
}
