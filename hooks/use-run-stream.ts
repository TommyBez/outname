"use client"

import { useEffect, useState } from "react"
import type { RunEvent, RunStepName } from "@/lib/run-events"

export type StreamStatus = "connecting" | "open" | "done" | "error" | "failed"

/** Derived per-step state for rendering the timeline. */
export interface StepState {
  name: RunStepName
  label: string
  status: "pending" | "active" | "done" | "error"
  message: string
  meta?: Record<string, unknown>
  updatedAt: number
}

const STEP_ORDER: { name: RunStepName; label: string }[] = [
  { name: "read", label: "Reading inbox" },
  { name: "classify", label: "Classifying" },
  { name: "persist", label: "Saving briefing" },
  { name: "finalize", label: "Finalizing" },
]

function initialSteps(): StepState[] {
  const now = Date.now()
  return STEP_ORDER.map((s) => ({
    name: s.name,
    label: s.label,
    status: "pending",
    message: "",
    updatedAt: now,
  }))
}

/**
 * Read the /api/runs/[runId]/stream newline-delimited JSON response and
 * derive per-step UI state. Uses plain fetch + ReadableStream - no
 * EventSource, no SSE reconnect gymnastics. On unmount (or runId change)
 * we abort the in-flight request.
 */
export function useRunStream(runId: string) {
  const [steps, setSteps] = useState<StepState[]>(initialSteps)
  const [status, setStatus] = useState<StreamStatus>("connecting")
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    console.log("[v0] useRunStream effect starting for runId:", runId)

    // Reset per-run state whenever the runId changes.
    setSteps(initialSteps())
    setStatus("connecting")
    setConnected(false)

    async function run() {
      console.log("[v0] useRunStream: starting fetch")
      try {
        const res = await fetch(`/api/runs/${runId}/stream`, {
          signal: controller.signal,
          headers: { Accept: "application/x-ndjson" },
          cache: "no-store",
        })
        console.log("[v0] useRunStream: fetch returned", res.status, res.ok)
        if (!res.ok || !res.body) {
          console.log("[v0] useRunStream: bad response, setting error")
          setStatus("error")
          return
        }
        console.log("[v0] useRunStream: setting connected=true")
        setStatus("open")
        setConnected(true)

        // Yield to let React flush the "connected" state before we block on
        // reader.read(). Without this, React batches the state updates and
        // never re-renders until the stream yields a chunk.
        await new Promise((r) => setTimeout(r, 0))

        const reader = res.body
          .pipeThrough(new TextDecoderStream())
          .getReader()

        let buffer = ""
        console.log("[v0] useRunStream: entering read loop")
        for (;;) {
          const { value, done } = await reader.read()
          console.log("[v0] useRunStream: read() returned", { done, len: value?.length })
          if (done) break
          buffer += value
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""
          for (const line of lines) {
            if (!line.trim()) continue
            let evt: RunEvent
            try {
              evt = JSON.parse(line) as RunEvent
            } catch {
              continue
            }
            apply(evt)
          }
        }
        setStatus((prev) => (prev === "failed" ? prev : "done"))
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return
        setStatus("error")
      }
    }

    function apply(evt: RunEvent) {
      if (evt.type === "step") {
        setSteps((prev) =>
          prev.map((s) => {
            if (s.name !== evt.step) return s
            const nextStatus: StepState["status"] =
              evt.status === "done"
                ? "done"
                : evt.status === "error"
                  ? "error"
                  : "active"
            return {
              ...s,
              status: nextStatus,
              message: evt.message,
              meta: evt.meta,
              updatedAt: evt.ts,
            }
          }),
        )
      } else if (evt.type === "run") {
        if (evt.status === "failed") setStatus("failed")
      }
    }

    run()
    return () => controller.abort()
  }, [runId])

  return { steps, status, connected }
}
