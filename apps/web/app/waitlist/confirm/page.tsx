import { WaitlistConfirmButton } from '@outname/shared/waitlist/components/waitlist-confirm-button'
import { Button } from '@outname/ui/components/ui/button'
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
    <main className="grid min-h-svh place-items-center bg-background px-6 py-12">
      <div className="w-full max-w-xl border border-border bg-background p-8 md:p-10">
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
        <Button asChild variant="outline">
          <Link href="/">Back to home</Link>
        </Button>
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
        <Button asChild variant="outline">
          <Link href="/waitlist?source=confirm-page">Request a new link</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="pt-5">
      <p className="swiss-label text-brand">00. waitlist confirm</p>
      <h1 className="mt-4 font-semibold font-serif text-5xl leading-[0.9] tracking-tighter">
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
