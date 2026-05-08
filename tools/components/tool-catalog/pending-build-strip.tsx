'use client'

import { useRouter } from 'next/navigation'
import { useToolSandboxBuildStream } from '@/tools/hooks/use-tool-sandbox-build-stream'

export function PendingBuildStrip({ buildId }: { buildId: string }) {
  const router = useRouter()
  const state = useToolSandboxBuildStream(buildId, () => {
    // Both terminal states refresh the row from the latest attachment data.
    router.refresh()
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
    <div
      aria-live="polite"
      className={`flex items-center gap-3 border-2 px-3 py-2 ${
        isError
          ? 'border-destructive bg-destructive/5 text-destructive'
          : 'border-foreground bg-muted'
      }`}
      role="status"
    >
      {!isError && (
        <span
          aria-hidden="true"
          className="inline-block h-2 w-2 animate-pulse rounded-full bg-foreground"
        />
      )}
      <p className="font-mono text-xs leading-relaxed">{label}</p>
    </div>
  )
}
