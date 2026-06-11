'use client'

import { useEffect } from 'react'
import { SectionErrorPanel } from '../_components/section-error-panel'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function AppSectionError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.error(error)
    }
  }, [error])

  return (
    <SectionErrorPanel
      description="This page failed to load. Your other pages are unaffected — try again or head back to the dashboard."
      digest={error.digest}
      onReset={reset}
      title="Page failed to load"
    />
  )
}
