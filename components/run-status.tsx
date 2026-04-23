"use client"

import useSWR from "swr"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { cn } from "@/lib/utils"
import { formatRelative } from "@/lib/format"

interface StatusResp {
  runId: string
  status: "running" | "completed" | "failed"
  liveStatus: string | null
  startedAt: string
  completedAt: string | null
  error: string | null
}

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<StatusResp>)

const LABEL: Record<StatusResp["status"], string> = {
  running: "Running",
  completed: "Completed",
  failed: "Failed",
}

export function RunStatus({
  runId,
  initialStatus,
  showTime = true,
}: {
  runId: string
  initialStatus: "running" | "completed" | "failed"
  showTime?: boolean
}) {
  const router = useRouter()
  const { data } = useSWR(`/api/runs/${runId}/status`, fetcher, {
    refreshInterval: initialStatus === "running" ? 3000 : 0,
    fallbackData: undefined,
  })
  const status = data?.status ?? initialStatus

  useEffect(() => {
    if (initialStatus === "running" && status !== "running") {
      router.refresh()
    }
  }, [status, initialStatus, router])

  const dot =
    status === "running"
      ? "bg-accent animate-pulse"
      : status === "completed"
        ? "bg-foreground/50"
        : "bg-destructive"

  const tone = status === "failed" ? "text-destructive" : "text-foreground"

  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span className={cn("inline-block size-1.5 rounded-full", dot)} aria-hidden />
      <span className={tone}>{LABEL[status]}</span>
      {showTime && status !== "running" && data?.completedAt && (
        <span className="text-muted-foreground">· {formatRelative(data.completedAt)}</span>
      )}
    </span>
  )
}
