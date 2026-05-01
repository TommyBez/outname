import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { auth } from '@/lib/auth'
import { createPrivatePageMetadata } from '@/lib/site-metadata'
import { LoginForm } from './login-form'

export const metadata: Metadata = createPrivatePageMetadata(
  'Sign in',
  "Access your OUTNA.ME agents, schedules, tools, and today's run."
)

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  return (
    <main className="swiss-grid-pattern grid min-h-svh place-items-center bg-background px-6">
      <div className="w-full max-w-md border-4 border-foreground bg-background p-8">
        <div className="mb-10 border-foreground border-t-4 pt-5">
          <p className="swiss-label text-accent">00. agents</p>
          <h1 className="mt-4 font-black font-serif text-5xl uppercase leading-[0.9] tracking-tighter">
            Sign in
          </h1>
          <p className="mt-4 border-foreground border-l-2 pl-4 text-muted-foreground text-sm leading-relaxed">
            Access your scheduled agents and today&apos;s run.
          </p>
        </div>
        <Suspense fallback={<LoginForm redirectTo="/today" />}>
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
    redirect('/today')
  }
  const { from } = await searchParams
  return <LoginForm redirectTo={from || '/today'} />
}
