"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useRunStream, type StepState } from "@/hooks/use-run-stream"
import { MorphingText } from "@/components/morphing-text"
import { cn } from "@/lib/utils"

export function RunProgress({ runId }: { runId: string }) {
  const router = useRouter()
  const { steps, status, connected } = useRunStream(runId)

  // When the stream signals completion, refresh the server data so the
  // dashboard re-renders with the run's saved result instead of the
  // progress view.
  useEffect(() => {
    if (status === "done" || status === "failed") {
      const t = setTimeout(() => router.refresh(), 400)
      return () => clearTimeout(t)
    }
  }, [status, router])

  const activeStep = steps.find((s) => s.status === "active")
  const lastDone = [...steps].reverse().find((s) => s.status === "done")
  const latestMessage =
    activeStep?.message ||
    lastDone?.message ||
    (!connected ? "Connecting…" : "Waiting for the first step…")

  return (
    <div className="border-t border-border pt-10">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
        In progress
      </p>
      <MorphingText
        as="p"
        text={latestMessage}
        className="mt-3 font-serif text-2xl leading-snug"
      />

      <ol className="mt-8 flex flex-col gap-4" aria-live="polite" aria-busy={status === "open"}>
        {steps.map((step, i) => (
          <StepRow key={step.name} step={step} index={i} />
        ))}
      </ol>

      {status === "error" && (
        <p className="mt-6 font-mono text-xs uppercase tracking-wider text-destructive">
          Connection lost — reconnecting...
        </p>
      )}
    </div>
  )
}

function StepRow({ step, index }: { step: StepState; index: number }) {
  const dot =
    step.status === "active"
      ? "bg-foreground animate-pulse ring-4 ring-foreground/10"
      : step.status === "done"
        ? "bg-foreground"
        : step.status === "error"
          ? "bg-destructive"
          : "bg-border"

  const label =
    step.status === "error"
      ? "text-destructive"
      : step.status === "pending"
        ? "text-muted-foreground"
        : "text-foreground"

  return (
    <li className="grid grid-cols-[auto_auto_1fr] items-start gap-4">
      <span
        aria-hidden
        className="mt-1.5 font-mono text-xs tabular-nums text-muted-foreground"
      >
        {String(index + 1).padStart(2, "0")}
      </span>
      <span
        aria-hidden
        className={cn(
          "mt-2 inline-block size-2 shrink-0 rounded-full transition-colors",
          dot,
        )}
      />
      <div className="flex flex-col gap-0.5">
        <span className={cn("text-sm font-medium transition-colors", label)}>
          {step.label}
        </span>
        {step.message && step.status !== "pending" && (
          <MorphingText
            text={step.message}
            className="text-xs text-muted-foreground"
          />
        )}
      </div>
    </li>
  )
}
