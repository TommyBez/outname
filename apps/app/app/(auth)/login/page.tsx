import { LoginForm } from '@outname/auth/components/login-form'
import { auth } from '@outname/auth/server/auth'
import { createPrivatePageMetadata } from '@outname/shared/server/site-metadata'
import { isWaitlistPublicEnabled } from '@outname/shared/waitlist/server/public-config'
import { Skeleton } from '@outname/ui/components/ui/skeleton'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'

export const metadata: Metadata = createPrivatePageMetadata(
  'Sign in',
  "Access your OUTNA.ME agents, schedules, tools, and today's run with an email code."
)

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  const waitlistEnabled = isWaitlistPublicEnabled()

  return (
    <main className="swiss-grid-pattern grid min-h-svh place-items-center bg-background px-6">
      <div className="w-full max-w-md border border-border bg-background p-8">
        <div className="mb-10 border-border border-t-4 pt-5">
          <p className="swiss-label text-brand">00. agents</p>
          <h1 className="mt-4 font-black font-serif text-5xl uppercase leading-[0.9] tracking-tighter">
            Sign in
          </h1>
          <p className="mt-4 border-border border-l pl-4 text-muted-foreground text-sm leading-relaxed">
            Request a one-time code by email to access your scheduled agents and
            live dashboard.
          </p>
        </div>
        <Suspense fallback={<LoginFormSkeleton />}>
          <LoginGate searchParams={searchParams} />
        </Suspense>
        {waitlistEnabled ? (
          <div className="mt-8 border-border border-t pt-5">
            <p className="font-mono text-[11px] text-muted-foreground uppercase tracking-normal">
              Need access first?
            </p>
            <Link
              className="mt-3 inline-flex min-h-11 items-center justify-center border border-border px-4 font-bold text-xs uppercase tracking-[0.16em] transition-colors hover:bg-foreground hover:text-background"
              href="/waitlist?source=login-page"
            >
              Join the waitlist
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  )
}

async function LoginGate({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session) {
    redirect('/dashboard')
  }
  const { from } = await searchParams
  return <LoginForm redirectTo={from || '/dashboard'} />
}

function LoginFormSkeleton() {
  return (
    <output
      aria-busy="true"
      aria-label="Loading sign in form"
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-10 w-full border border-border" />
      </div>
      <Skeleton className="mt-2 h-10 w-full border border-border" />
    </output>
  )
}
