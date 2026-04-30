'use client'

import { useEffect, useState } from 'react'

export type ToolSandboxBuildState =
  | { kind: 'idle' }
  | { kind: 'connecting' }
  | { kind: 'progress'; message: string; phase?: string }
  | { kind: 'ready' }
  | { kind: 'failed'; error: string }

interface BuildStreamEvent {
  error?: string
  message?: string
  phase?: string
  ts?: string
  type: 'progress' | 'ready' | 'failed' | string
}

type StreamSetter = (state: ToolSandboxBuildState) => void
type TerminalCallback = (state: 'ready' | 'failed', error?: string) => void

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
  onTerminal?: TerminalCallback
): ToolSandboxBuildState {
  const [state, setState] = useState<ToolSandboxBuildState>({ kind: 'idle' })

  useEffect(() => {
    if (!buildId) {
      setState({ kind: 'idle' })
      return
    }

    const abort = new AbortController()
    const ctx = { cancelled: false }
    setState({ kind: 'connecting' })

    consumeStream({ buildId, abort, ctx, setState, onTerminal })

    return () => {
      ctx.cancelled = true
      abort.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildId, onTerminal])

  return state
}

interface ConsumeStreamArgs {
  abort: AbortController
  buildId: string
  ctx: { cancelled: boolean }
  onTerminal?: TerminalCallback
  setState: StreamSetter
}

async function consumeStream(args: ConsumeStreamArgs): Promise<void> {
  const { buildId, abort, ctx, setState, onTerminal } = args
  try {
    const res = await fetch(
      `/api/tool-sandbox-builds/${encodeURIComponent(buildId)}/stream?startIndex=0`,
      { signal: abort.signal }
    )
    if (!(res.ok && res.body)) {
      if (!ctx.cancelled) {
        setState({
          kind: 'failed',
          error: `stream open failed (${res.status})`,
        })
      }
      return
    }
    await readNdjson({
      body: res.body,
      ctx,
      onEvent: (evt) => applyEvent({ evt, ctx, setState, onTerminal }),
    })
  } catch (err) {
    if (ctx.cancelled || abort.signal.aborted) {
      return
    }
    setState({
      kind: 'failed',
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

async function readNdjson(input: {
  body: ReadableStream<Uint8Array>
  ctx: { cancelled: boolean }
  onEvent: (evt: BuildStreamEvent) => void
}): Promise<void> {
  const reader = input.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (!input.ctx.cancelled) {
    const { done, value } = await reader.read()
    if (done) {
      return
    }
    buffer += decoder.decode(value, { stream: true })
    buffer = drainLines(buffer, input.onEvent)
  }
}

function drainLines(
  buffer: string,
  onEvent: (evt: BuildStreamEvent) => void
): string {
  let working = buffer
  let nl = working.indexOf('\n')
  while (nl >= 0) {
    const line = working.slice(0, nl).trim()
    working = working.slice(nl + 1)
    nl = working.indexOf('\n')
    if (!line) {
      continue
    }
    try {
      onEvent(JSON.parse(line) as BuildStreamEvent)
    } catch (err) {
      // Skip malformed lines — the stream is best-effort.
      console.error('[v0] useToolSandboxBuildStream: bad line', line, err)
    }
  }
  return working
}

function applyEvent(input: {
  evt: BuildStreamEvent
  ctx: { cancelled: boolean }
  setState: StreamSetter
  onTerminal?: TerminalCallback
}): void {
  const { evt, ctx, setState, onTerminal } = input
  if (ctx.cancelled) {
    return
  }
  if (evt.type === 'progress') {
    setState({
      kind: 'progress',
      message: evt.message ?? 'Working...',
      phase: evt.phase,
    })
    return
  }
  if (evt.type === 'ready') {
    setState({ kind: 'ready' })
    onTerminal?.('ready')
    return
  }
  if (evt.type === 'failed') {
    setState({
      kind: 'failed',
      error: evt.error ?? 'Build failed',
    })
    onTerminal?.('failed', evt.error)
  }
}
