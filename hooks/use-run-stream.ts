'use client'

import { useEffect, useState } from 'react'
import type { RunEvent, RunStepName } from '@/lib/run-events'

export type StreamStatus = 'connecting' | 'open' | 'done' | 'error' | 'failed'

/** Derived per-step state for rendering the timeline. */
export interface StepState {
  label: string
  message: string
  meta?: Record<string, unknown>
  name: RunStepName
  status: 'pending' | 'active' | 'done' | 'error'
  updatedAt: number
}

const STEP_ORDER: { name: RunStepName; label: string }[] = [
  { name: 'read', label: 'Reading inbox' },
  { name: 'classify', label: 'Classifying' },
  { name: 'persist', label: 'Saving briefing' },
  { name: 'finalize', label: 'Finalizing' },
]

function initialSteps(): StepState[] {
  const now = Date.now()
  return STEP_ORDER.map((s) => ({
    name: s.name,
    label: s.label,
    status: 'pending',
    message: '',
    updatedAt: now,
  }))
}

function eventStepStatus(status: string): StepState['status'] {
  if (status === 'done') {
    return 'done'
  }
  if (status === 'error') {
    return 'error'
  }
  return 'active'
}

function parseEventLine(line: string): RunEvent | null {
  try {
    return JSON.parse(line) as RunEvent
  } catch {
    return null
  }
}

async function drainNdjsonStream(
  reader: ReadableStreamDefaultReader<string>,
  onEvent: (evt: RunEvent) => void
): Promise<void> {
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) {
      break
    }
    buffer += value
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) {
        continue
      }
      const evt = parseEventLine(line)
      if (evt) {
        onEvent(evt)
      }
    }
  }
}

/**
 * Read the /api/runs/[runId]/stream newline-delimited JSON response and
 * derive per-step UI state. Uses plain fetch + ReadableStream - no
 * EventSource, no SSE reconnect gymnastics. On unmount (or runId change)
 * we abort the in-flight request.
 */
export function useRunStream(runId: string) {
  const [steps, setSteps] = useState<StepState[]>(initialSteps)
  const [status, setStatus] = useState<StreamStatus>('connecting')
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    setSteps(initialSteps())
    setStatus('connecting')
    setConnected(false)

    function applyEvent(evt: RunEvent) {
      if (evt.type === 'step') {
        setSteps((prev) =>
          prev.map((s) => {
            if (s.name !== evt.step) {
              return s
            }
            return {
              ...s,
              status: eventStepStatus(evt.status),
              message: evt.message,
              meta: evt.meta,
              updatedAt: evt.ts,
            }
          })
        )
        return
      }
      if (evt.type === 'run' && evt.status === 'failed') {
        setStatus('failed')
      }
    }

    async function run() {
      try {
        const res = await fetch(`/api/runs/${runId}/stream`, {
          signal: controller.signal,
          headers: { Accept: 'application/x-ndjson' },
          cache: 'no-store',
        })
        if (!(res.ok && res.body)) {
          setStatus('error')
          return
        }
        setStatus('open')
        setConnected(true)

        await new Promise((r) => setTimeout(r, 0))

        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
        await drainNdjsonStream(reader, applyEvent)
        setStatus((prev) => (prev === 'failed' ? prev : 'done'))
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') {
          return
        }
        setStatus('error')
      }
    }

    run()
    return () => controller.abort()
  }, [runId])

  return { steps, status, connected }
}
