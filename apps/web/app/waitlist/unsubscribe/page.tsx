import type { Metadata } from 'next'
import { Suspense } from 'react'
import {
  WaitlistUnsubscribeFallback,
  WaitlistUnsubscribeStatus,
} from './unsubscribe-status'

export const metadata: Metadata = {
  title: 'Waitlist preferences',
  description: 'Manage OUTNA.ME waitlist email preferences.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function WaitlistUnsubscribePage() {
  return (
    <main className="swiss-grid-pattern grid min-h-svh place-items-center bg-background px-6 py-12">
      <div className="w-full max-w-xl border-4 border-foreground bg-background p-8 md:p-10">
        <Suspense fallback={<WaitlistUnsubscribeFallback />}>
          <WaitlistUnsubscribeStatus />
        </Suspense>
      </div>
    </main>
  )
}
