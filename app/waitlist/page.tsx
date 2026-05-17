import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { WaitlistSignupForm } from '@/waitlist/components/waitlist-signup-form'

export const metadata: Metadata = {
  title: 'Join waitlist',
  description: 'Request early access to OUTNA.ME.',
  alternates: {
    canonical: '/waitlist',
  },
}

export default async function WaitlistPage({
  searchParams,
}: {
  searchParams: Promise<{
    source?: string
    utm_campaign?: string
    utm_content?: string
    utm_medium?: string
    utm_source?: string
  }>
}) {
  return (
    <main className="swiss-grid-pattern grid min-h-svh place-items-center bg-background px-6 py-12">
      <div className="w-full max-w-2xl border-4 border-foreground bg-background p-8 md:p-10">
        <Suspense fallback={<WaitlistFallback />}>
          <WaitlistPageContent searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  )
}

async function WaitlistPageContent({
  searchParams,
}: {
  searchParams: Promise<{
    source?: string
    utm_campaign?: string
    utm_content?: string
    utm_medium?: string
    utm_source?: string
  }>
}) {
  const params = await searchParams

  return (
    <>
      <div className="mb-10 border-foreground border-t-4 pt-5">
        <p className="swiss-label text-accent">00. early access</p>
        <h1 className="mt-4 font-black font-serif text-4xl uppercase leading-[0.9] tracking-tighter sm:text-5xl lg:text-6xl">
          Join the waitlist
        </h1>
        <p className="mt-4 max-w-xl border-foreground border-l-2 pl-4 text-muted-foreground text-sm leading-relaxed">
          Request access to OUTNA.ME. We&apos;ll email a confirmation link, then
          notify you when your spot is ready.
        </p>
      </div>

      <WaitlistSignupForm
        initialSource={params.source ?? 'waitlist-page'}
        utmCampaign={params.utm_campaign}
        utmContent={params.utm_content}
        utmMedium={params.utm_medium}
        utmSource={params.utm_source}
      />

      <div className="mt-8 border-foreground border-t-2 pt-5 text-xs uppercase tracking-[0.14em]">
        Already have access?{' '}
        <Link
          className="font-bold text-accent underline-offset-4 hover:underline"
          href="/login?from=/dashboard"
        >
          Sign in
        </Link>
      </div>
    </>
  )
}

function WaitlistFallback() {
  return (
    <div className="border-foreground border-t-4 pt-5 text-muted-foreground text-sm">
      Loading waitlist…
    </div>
  )
}
