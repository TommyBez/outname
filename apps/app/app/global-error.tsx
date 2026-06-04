'use client'

import { Geist_Mono, Inter } from 'next/font/google'
import { useEffect } from 'react'
import { AppErrorScreen } from './_components/app-error-screen'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
})

interface GlobalErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalErrorPage({
  error,
  reset,
}: GlobalErrorPageProps) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.error(error)
    }
  }, [error])

  return (
    <html
      className={`${inter.variable} ${geistMono.variable} bg-background`}
      lang="en"
    >
      <body className="font-sans antialiased">
        <AppErrorScreen
          description="A critical error prevented the app from loading. Try again or return home."
          digest={error.digest}
          eyebrow="Critical error"
          onReset={reset}
          title="Application failure"
        />
      </body>
    </html>
  )
}
