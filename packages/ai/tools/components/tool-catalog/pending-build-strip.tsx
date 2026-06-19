'use client'

import { useToolSandboxBuildStream } from '@outname/ai/tools/hooks/use-tool-sandbox-build-stream'
import { useRouter } from 'next/navigation'

export function PendingBuildStrip({ buildId }: { buildId: string }) {
  const { refresh } = useRouter()
  const state = useToolSandboxBuildStream(buildId, () => {
    // Both terminal states refresh the row from the latest attachment data.
    refresh()
  })

  let label = 'Preparing tool environment...'
  if (state.kind === 'progress') {
    label = state.message
  } else if (state.kind === 'connecting') {
    label = 'Connecting to build stream...'
  } else if (state.kind === 'ready') {
    label = 'Snapshot ready, finalizing...'
  } else if (state.kind === 'failed') {
    label = `Build failed: ${state.error}`
  }

  const isError = state.kind === 'failed'

  return (
    <output
      aria-live="polite"
      className={`flex items-center gap-3 border px-3 py-2 ${
        isError
          ? 'border-destructive bg-destructive/5 text-destructive'
          : 'border-border bg-muted'
      }`}
    >
      {!isError && (
        <span
          aria-hidden="true"
          className="inline-block size-2 animate-pulse rounded-full bg-foreground"
        />
      )}
      <span className="font-mono text-xs leading-relaxed">{label}</span>
    </output>
  )
}
