'use client'

import { getToolSandboxBuildStatusAction } from '@outname/ai/tools/sandbox-runtime/actions'
import { apiUrl } from '@outname/shared/api-url'
import { useEffect, useRef, useState } from 'react'

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

// Stream coarse build progress from `startIndex=0` so remounts replay the
// whole run. If the workflow stream is gone, fall back to the terminal-status
// action instead of trying to recover non-persisted progress history.
export function useToolSandboxBuildStream(
  buildId: string | null,
  onTerminal?: TerminalCallback
): ToolSandboxBuildState {
  const [state, setState] = useState<ToolSandboxBuildState>({ kind: 'idle' })
  const onTerminalRef = useRef<TerminalCallback | undefined>(onTerminal)
  onTerminalRef.current = onTerminal

  useEffect(() => {
    if (!buildId) {
      setState({ kind: 'idle' })
      return
    }

    const abort = new AbortController()
    const ctx = { cancelled: false }
    setState({ kind: 'connecting' })

    consumeStream({
      buildId,
      abort,
      ctx,
      setState,
      onTerminal: (terminalState, error) => {
        onTerminalRef.current?.(terminalState, error)
      },
    })

    return () => {
      ctx.cancelled = true
      abort.abort()
    }
  }, [buildId])

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
      apiUrl(
        `/api/tool-sandbox-builds/${encodeURIComponent(buildId)}/stream?startIndex=0`
      ),
      { signal: abort.signal }
    )
    if (!(res.ok && res.body)) {
      await recoverFromStatusAction({
        buildId,
        ctx,
        setState,
        onTerminal,
        fallbackError: `stream open failed (${res.status})`,
      })
      return
    }
    await readNdjson({
      body: res.body,
      ctx,
      onEvent: (evt) => applyEvent({ evt, ctx, setState, onTerminal }),
    })
    if (!ctx.cancelled) {
      await recoverFromStatusAction({ buildId, ctx, setState, onTerminal })
    }
  } catch (err) {
    if (ctx.cancelled || abort.signal.aborted) {
      return
    }
    await recoverFromStatusAction({
      buildId,
      ctx,
      setState,
      onTerminal,
      fallbackError: err instanceof Error ? err.message : String(err),
    })
  }
}

async function recoverFromStatusAction(input: {
  buildId: string
  ctx: { cancelled: boolean }
  fallbackError?: string
  onTerminal?: TerminalCallback
  setState: StreamSetter
}): Promise<void> {
  const { buildId, ctx, fallbackError, setState, onTerminal } = input
  if (ctx.cancelled) {
    return
  }
  try {
    const status = await getToolSandboxBuildStatusAction(buildId)
    if (ctx.cancelled) {
      return
    }
    if (!status || status.status === 'forbidden') {
      setState({ kind: 'failed', error: fallbackError ?? 'build unavailable' })
      return
    }
    if (status.status === 'ready') {
      setState({ kind: 'ready' })
      onTerminal?.('ready')
      return
    }
    if (status.status === 'failed') {
      const error = status.errorText ?? fallbackError ?? 'Build failed'
      setState({ kind: 'failed', error })
      onTerminal?.('failed', error)
      return
    }
    setState({
      kind: 'progress',
      message: 'Build is still running. Refreshing status shortly...',
    })
  } catch (err) {
    if (ctx.cancelled) {
      return
    }
    setState({
      kind: 'failed',
      error:
        fallbackError ??
        (err instanceof Error ? err.message : 'build status unavailable'),
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
      console.error('useToolSandboxBuildStream: bad line', line, err)
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
