'use client'

import { useEffect } from 'react'
import { AppErrorScreen } from './_components/app-error-screen'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.error(error)
    }
  }, [error])

  return (
    <AppErrorScreen
      description="Something went wrong while loading this page. You can try again or return home."
      digest={error.digest}
      eyebrow="Error"
      onReset={reset}
      title="Unexpected failure"
    />
  )
}
