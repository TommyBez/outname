'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

function WaitlistUnsubscribeMessage({ status }: { status: string | null }) {
  const isUnsubscribed = status === 'unsubscribed'

  return (
    <div className="border-foreground border-t-4 pt-5">
      <p className="swiss-label text-accent">00. waitlist preferences</p>
      <h1 className="mt-4 font-black font-serif text-5xl uppercase leading-[0.9] tracking-tighter">
        {isUnsubscribed ? 'Unsubscribed' : 'Link invalid'}
      </h1>
      <p className="mt-8 text-sm leading-relaxed">
        {isUnsubscribed
          ? 'You will no longer receive OUTNA.ME waitlist launch updates.'
          : 'This preference link is invalid or has expired.'}
      </p>
      <Link
        className="mt-6 inline-flex min-h-11 items-center justify-center border-2 border-foreground px-4 font-bold text-xs uppercase tracking-[0.14em] transition-colors hover:bg-foreground hover:text-background"
        href="/"
      >
        Back to home
      </Link>
    </div>
  )
}

export function WaitlistUnsubscribeFallback() {
  return <WaitlistUnsubscribeMessage status={null} />
}

export function WaitlistUnsubscribeStatus() {
  const searchParams = useSearchParams()
  return <WaitlistUnsubscribeMessage status={searchParams.get('status')} />
}
