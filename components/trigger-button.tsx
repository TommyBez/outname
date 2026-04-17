"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Play } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

export function TriggerButton({
  variant = "default",
  label = "Run now",
}: {
  variant?: "default" | "outline"
  label?: string
}) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  async function trigger() {
    setIsLoading(true)
    try {
      const res = await fetch("/api/workflow/trigger", { method: "POST" })
      if (!res.ok) throw new Error(await res.text())
      const { runId } = await res.json()
      toast.success("Run started", { description: `ID ${runId.slice(0, 8)}` })
      startTransition(() => router.refresh())
    } catch (err) {
      toast.error("Failed to start run", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant={variant}
      size="sm"
      onClick={trigger}
      disabled={isLoading || isPending}
      className="gap-2"
    >
      {isLoading ? <Spinner className="size-3.5" /> : <Play className="size-3.5" />}
      {label}
    </Button>
  )
}
