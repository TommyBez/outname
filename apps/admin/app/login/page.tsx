import { LoginForm } from '@outname/auth/components/login-form'
import { createPrivatePageMetadata } from '@outname/shared/server/site-metadata'
import { Skeleton } from '@outname/ui/components/ui/skeleton'
import type { Metadata } from 'next'
import { Suspense } from 'react'

export const metadata: Metadata = createPrivatePageMetadata(
  'Admin sign in',
  'Sign in to the OUTNA.ME admin dashboard.'
)

function getAdminRedirectPath(from?: string): string {
  if (!(from?.startsWith('/') && !from.startsWith('//'))) {
    return '/'
  }

  const url = new URL(from, 'http://admin.local')
  if (url.pathname === '/login') {
    return '/'
  }

  return `${url.pathname}${url.search}`
}

export default function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  return (
    <main className="swiss-grid-pattern grid min-h-svh place-items-center bg-background px-6">
      <div className="w-full max-w-md border-4 border-foreground bg-background p-8">
        <div className="mb-10 border-foreground border-t-4 pt-5">
          <p className="swiss-label text-accent">00. admin</p>
          <h1 className="mt-4 font-black font-serif text-5xl uppercase leading-[0.9] tracking-tighter">
            Sign in
          </h1>
          <p className="mt-4 border-foreground border-l-2 pl-4 text-muted-foreground text-sm leading-relaxed">
            Request a one-time code to access the OUTNA.ME administration
            workspace.
          </p>
        </div>
        <Suspense fallback={<LoginFormSkeleton />}>
          <AdminLoginGate searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  )
}

async function AdminLoginGate({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  const { from } = await searchParams
  return <LoginForm redirectTo={getAdminRedirectPath(from)} />
}

function LoginFormSkeleton() {
  return (
    <output
      aria-busy="true"
      aria-label="Loading admin sign in form"
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-10 w-full border-2 border-border" />
      </div>
      <Skeleton className="mt-2 h-10 w-full border-2 border-border" />
    </output>
  )
}
