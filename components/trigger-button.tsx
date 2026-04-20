"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

/**
 * Triggers a manual run for a specific agent. `agentId` is required; there
 * is no implicit "default agent" since this is a multi-agent platform.
 */
export function TriggerButton({
  agentId,
  variant = "default",
  label = "Run now",
  className,
}: {
  agentId: string
  variant?: "default" | "outline" | "link"
  label?: string
  className?: string
}) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  async function trigger() {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/agents/${agentId}/trigger`, {
        method: "POST",
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const { runId } = await res.json()
      toast.success("Run started", { description: `ID ${runId.slice(0, 8)}` })
      startTransition(() => router.refresh())
    } catch (err) {
      toast.error("Could not start run", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (variant === "link") {
    return (
      <button
        type="button"
        onClick={trigger}
        disabled={isLoading || isPending}
        className={cn(
          "text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50",
          className,
        )}
      >
        {isLoading ? "Starting…" : label}
      </button>
    )
  }

  return (
    <Button
      variant={variant}
      size="sm"
      onClick={trigger}
      disabled={isLoading || isPending}
      className={cn("font-medium", className)}
    >
      {isLoading ? <Spinner className="mr-1 size-3.5" /> : null}
      {isLoading ? "Starting…" : label}
    </Button>
  )
}
