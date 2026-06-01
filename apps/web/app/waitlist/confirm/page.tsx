import { WaitlistConfirmButton } from '@outname/shared/waitlist/components/waitlist-confirm-button'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'

export const metadata: Metadata = {
  title: 'Confirm waitlist request',
  description: 'Confirm your waitlist request for OUTNA.ME.',
  robots: {
    index: false,
    follow: false,
  },
}

export default async function WaitlistConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string
    token?: string
  }>
}) {
  return (
    <main className="swiss-grid-pattern grid min-h-svh place-items-center bg-background px-6 py-12">
      <div className="w-full max-w-xl border-4 border-foreground bg-background p-8 md:p-10">
        <Suspense fallback={<ConfirmFallback />}>
          <ConfirmContent searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  )
}

async function ConfirmContent({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string
    token?: string
  }>
}) {
  const { status, token } = await searchParams
  let content: React.ReactNode
  let title = 'Confirm your email'

  if (status === 'confirmed') {
    title = 'Confirmed'
    content = (
      <div className="mt-8 space-y-4">
        <p className="text-sm leading-relaxed">
          Your email is confirmed. We&apos;ll reach out when access is ready and
          prepare your account automatically.
        </p>
        <Link
          className="inline-flex min-h-11 items-center justify-center border-2 border-foreground px-4 font-bold text-xs uppercase tracking-[0.14em] transition-colors hover:bg-foreground hover:text-background"
          href="/"
        >
          Back to home
        </Link>
      </div>
    )
  } else if (token) {
    content = (
      <div className="mt-8 space-y-5">
        <p className="text-sm leading-relaxed">
          Final step: confirm that this email address belongs to you.
        </p>
        <WaitlistConfirmButton token={token} />
      </div>
    )
  } else {
    content = (
      <div className="mt-8 space-y-4">
        <p className="text-sm leading-relaxed">
          This confirmation link is invalid or has expired.
        </p>
        <Link
          className="inline-flex min-h-11 items-center justify-center border-2 border-foreground px-4 font-bold text-xs uppercase tracking-[0.14em] transition-colors hover:bg-foreground hover:text-background"
          href="/waitlist?source=confirm-page"
        >
          Request a new link
        </Link>
      </div>
    )
  }

  return (
    <div className="border-foreground border-t-4 pt-5">
      <p className="swiss-label text-accent">00. waitlist confirm</p>
      <h1 className="mt-4 font-black font-serif text-5xl uppercase leading-[0.9] tracking-tighter">
        {title}
      </h1>
      {content}
    </div>
  )
}

function ConfirmFallback() {
  return (
    <output className="mt-8 text-muted-foreground text-sm">
      Loading confirmation state…
    </output>
  )
}
