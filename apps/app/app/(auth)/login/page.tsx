import { LoginForm } from '@outname/auth/components/login-form'
import { auth } from '@outname/auth/server/auth'
import { createPrivatePageMetadata } from '@outname/shared/server/site-metadata'
import { Skeleton } from '@outname/ui/components/ui/skeleton'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'

export const metadata: Metadata = createPrivatePageMetadata(
  'Sign in or create an account',
  "Start using OUTNA.ME agents, schedules, tools, and today's run with an email code."
)

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  return (
    <main className="grid min-h-svh place-items-center bg-background px-6">
      <div className="w-full max-w-md border border-border bg-background p-8">
        <div className="mb-10 border-border border-t pt-5">
          <h1 className="mt-4 font-semibold text-4xl tracking-tight">
            Sign in or create an account
          </h1>
          <p className="mt-4 text-muted-foreground text-sm leading-relaxed">
            Request a one-time code by email to access your scheduled agents or
            start a new account.
          </p>
        </div>
        <Suspense fallback={<LoginFormSkeleton />}>
          <LoginGate searchParams={searchParams} />
        </Suspense>
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
