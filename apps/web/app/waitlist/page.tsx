import { getAppLoginUrl } from '@outname/shared/app-url'
import { WaitlistSignupForm } from '@outname/shared/waitlist/components/waitlist-signup-form'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'

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
    <main className="grid min-h-svh place-items-center bg-background px-6 py-12">
      <div className="w-full max-w-2xl border border-border bg-background p-8 md:p-10">
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
      <div className="mb-10 pt-5">
        <p className="swiss-label text-brand">00. early access</p>
        <h1 className="mt-4 font-semibold font-serif text-4xl leading-[0.9] tracking-tighter sm:text-5xl lg:text-6xl">
          Join the waitlist
        </h1>
        <p className="mt-4 max-w-xl text-muted-foreground text-sm leading-relaxed">
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

      <div className="mt-8 border-border border-t pt-5 text-xs">
        Already have access?{' '}
        <Link
          className="font-bold text-brand underline-offset-4 hover:underline"
          href={getAppLoginUrl('/dashboard')}
        >
          Sign in
        </Link>
      </div>
    </>
  )
}

function WaitlistFallback() {
  return (
    <div className="pt-5 text-muted-foreground text-sm">Loading waitlist…</div>
  )
}
