'use client'

import { useEffect } from 'react'
import { SectionErrorPanel } from '../../_components/section-error-panel'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function AgentWorkspaceError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.error(error)
    }
  }, [error])

  return (
    <SectionErrorPanel
      description="This agent workspace failed to load. The rest of the app is still available — try again or return to your agents."
      digest={error.digest}
      homeHref="/agents"
      homeLabel="Back to agents"
      onReset={reset}
      title="Agent failed to load"
    />
  )
}
