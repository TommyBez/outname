import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { auth } from '@/lib/auth'
import { ensureAdminUser } from '@/lib/bootstrap'
import { LoginForm } from './login-form'

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  return (
    <main className="grid min-h-svh place-items-center bg-background px-6">
      <div className="w-full max-w-sm">
        <div className="mb-10">
          <p className="font-mono text-accent text-xs uppercase tracking-[0.2em]">
            ▪ agents
          </p>
          <h1 className="mt-3 font-medium font-mono text-2xl leading-tight tracking-tight">
            Sign in.
          </h1>
          <p className="mt-2 text-muted-foreground text-sm">
            Access your scheduled agents and today&apos;s run.
          </p>
        </div>
        <Suspense fallback={<LoginForm redirectTo="/" />}>
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
  await ensureAdminUser()
  const session = await auth.api.getSession({ headers: await headers() })
  if (session) {
    redirect('/')
  }
  const { from } = await searchParams
  return <LoginForm redirectTo={from || '/'} />
}
