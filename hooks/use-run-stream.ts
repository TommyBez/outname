"use client"

import { useEffect, useRef, useState } from "react"
import type { RunEvent, RunStepName } from "@/lib/run-events"

type ClientEvent =
  | RunEvent
  | { type: "meta"; message: string }

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

export function useRunStream(runId: string) {
  const [steps, setSteps] = useState<StepState[]>(initialSteps)
  const [events, setEvents] = useState<ClientEvent[]>([])
  const [status, setStatus] = useState<StreamStatus>("connecting")
  const [connected, setConnected] = useState(false)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    // Reset per-run state when the runId changes.
    setSteps(initialSteps())
    setEvents([])
    setStatus("connecting")
    setConnected(false)

    const es = new EventSource(`/api/runs/${runId}/stream`)
    esRef.current = es

    es.onopen = () => setStatus("open")

    es.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data) as ClientEvent
        setEvents((prev) => [...prev, evt])

        if (evt.type === "meta") {
          setConnected(true)
        } else if (evt.type === "step") {
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
      } catch {
        /* ignore malformed frames */
      }
    }

    es.addEventListener("done", () => {
      setStatus("done")
      es.close()
    })

    es.onerror = () => {
      // EventSource auto-reconnects on transient network errors using
      // Last-Event-ID. We only force "error" when it's permanently closed.
      if (es.readyState === EventSource.CLOSED) {
        setStatus((prev) => (prev === "done" ? prev : "error"))
      }
    }

    return () => {
      es.close()
      esRef.current = null
    }
  }, [runId])

  return { steps, events, status, connected }
}
