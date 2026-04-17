"use client"

import useSWR from "swr"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { formatRelative } from "@/lib/format"

interface StatusResp {
  runId: string
  status: "running" | "completed" | "failed"
  liveStatus: string | null
  startedAt: string
  completedAt: string | null
  emailsScanned: number
  error: string | null
}

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<StatusResp>)

export function RunStatus({
  runId,
  initialStatus,
  compact = false,
}: {
  runId: string
  initialStatus: "running" | "completed" | "failed"
  compact?: boolean
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

  const tone =
    status === "running"
      ? "bg-accent/15 text-accent-foreground border-accent/30"
      : status === "completed"
        ? "bg-chart-3/10 text-chart-3 border-chart-3/20"
        : "bg-destructive/10 text-destructive border-destructive/20"

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 font-mono text-xs uppercase tracking-wider",
        tone,
      )}
    >
      {status === "running" ? (
        <Spinner className="size-3" />
      ) : (
        <span
          className={cn(
            "inline-block size-1.5 rounded-full",
            status === "completed" ? "bg-chart-3" : "bg-destructive",
          )}
        />
      )}
      <span>{status}</span>
      {!compact && data?.completedAt && status !== "running" && (
        <span className="normal-case text-[10px] text-muted-foreground">
          {formatRelative(data.completedAt)}
        </span>
      )}
    </span>
  )
}
