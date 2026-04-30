'use client'

import { useEffect, useState } from 'react'

export type ToolSandboxBuildState =
  | { kind: 'idle' }
  | { kind: 'connecting' }
  | { kind: 'progress'; message: string; phase?: string }
  | { kind: 'ready' }
  | { kind: 'failed'; error: string }

interface BuildStreamEvent {
  type: 'progress' | 'ready' | 'failed' | string
  message?: string
  phase?: string
  error?: string
  ts?: string
}

/**
 * Phase 4: subscribe to a tool-sandbox build's NDJSON progress
 * stream.
 *
 * The build workflow publishes coarse-grained progress events (one
 * per phase: "Installing system dependencies...", "Capturing
 * snapshot...", etc.) and a single terminal `ready` or `failed`. We
 * open the stream with `startIndex: 0` so re-mounts replay the full
 * history — there is no DB-side persistence of progress messages on
 * purpose, the workflow run record is the single source of truth.
 *
 * On terminal events, we call `onTerminal` so the parent component
 * can `router.refresh()` and re-read the agent_tools row (whose
 * status flips from `pending` to `connected`).
 *
 * If the workflow run record has expired and the stream returns 404,
 * we don't try to recover progress history (we never had it on the
 * server anyway); the caller should fall back to the terminal-state
 * action and render only the final outcome.
 */
export function useToolSandboxBuildStream(
  buildId: string | null,
  onTerminal?: (state: 'ready' | 'failed', error?: string) => void
): ToolSandboxBuildState {
  const [state, setState] = useState<ToolSandboxBuildState>({ kind: 'idle' })

  useEffect(() => {
    if (!buildId) {
      setState({ kind: 'idle' })
      return
    }

    let cancelled = false
    const abort = new AbortController()

    setState({ kind: 'connecting' })

    async function run() {
      try {
        const res = await fetch(
          `/api/tool-sandbox-builds/${encodeURIComponent(buildId as string)}/stream?startIndex=0`,
          { signal: abort.signal }
        )
        if (!res.ok || !res.body) {
          if (cancelled) return
          setState({
            kind: 'failed',
            error: `stream open failed (${res.status})`,
          })
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (!cancelled) {
          const { done, value } = await reader.read()
          if (done) {
            break
          }
          buffer += decoder.decode(value, { stream: true })
          let nl = buffer.indexOf('\n')
          while (nl >= 0) {
            const line = buffer.slice(0, nl).trim()
            buffer = buffer.slice(nl + 1)
            nl = buffer.indexOf('\n')
            if (!line) continue
            try {
              const evt = JSON.parse(line) as BuildStreamEvent
              applyEvent(evt)
            } catch (err) {
              // Skip malformed lines — the stream is best-effort.
              console.error(
                '[v0] useToolSandboxBuildStream: bad line',
                line,
                err
              )
            }
          }
        }
      } catch (err) {
        if (cancelled || abort.signal.aborted) return
        setState({
          kind: 'failed',
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    function applyEvent(evt: BuildStreamEvent) {
      if (cancelled) return
      if (evt.type === 'progress') {
        setState({
          kind: 'progress',
          message: evt.message ?? 'Working...',
          phase: evt.phase,
        })
      } else if (evt.type === 'ready') {
        setState({ kind: 'ready' })
        onTerminal?.('ready')
      } else if (evt.type === 'failed') {
        setState({
          kind: 'failed',
          error: evt.error ?? 'Build failed',
        })
        onTerminal?.('failed', evt.error)
      }
    }

    run()

    return () => {
      cancelled = true
      abort.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildId])

  return state
}
