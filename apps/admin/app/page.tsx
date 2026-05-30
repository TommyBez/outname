import { requireAdminAccess } from '@outname/auth/server/admin-guard'
import { getWaitlistAdminOverview } from '@outname/shared/waitlist/server/service'
import { Badge } from '@outname/ui/components/ui/badge'
import { Button } from '@outname/ui/components/ui/button'
import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { AdminShell } from './_components/admin-shell'

export const metadata: Metadata = {
  title: 'Admin',
}

const overviewCards = [
  {
    key: 'pending',
    label: 'Pending confirmation',
    valueKey: 'pending',
  },
  {
    key: 'confirmed',
    label: 'Ready to invite',
    valueKey: 'confirmed',
  },
  {
    key: 'invited',
    label: 'Access emailed',
    valueKey: 'invited',
  },
  {
    key: 'provisioned',
    label: 'Provisioned users',
    valueKey: 'provisioned',
  },
] as const

export default function AdminHomePage() {
  return (
    <AdminShell>
      <Suspense fallback={<AdminOverviewFallback />}>
        <AdminOverviewContent />
      </Suspense>
    </AdminShell>
  )
}

async function AdminOverviewContent() {
  await connection()
  const [session, overview] = await Promise.all([
    requireAdminAccess(),
    getWaitlistAdminOverview(),
  ])

  return (
    <>
      <header className="mb-12 border-foreground border-t-4 pt-6 md:mb-16">
        <p className="swiss-label mb-4 text-accent">00. Admin / Overview</p>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-black font-serif text-5xl uppercase leading-[0.9] tracking-tighter sm:text-6xl lg:text-7xl xl:text-8xl">
              Control room
            </h1>
            <p className="mt-4 max-w-2xl text-muted-foreground text-sm leading-relaxed">
              Review access, invite users, and keep the public waitlist moving
              without entering the product workspace.
            </p>
          </div>
          <Badge className="self-start md:self-auto" variant="outline">
            {session.user.email}
          </Badge>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overviewCards.map((card) => (
          <article
            className="border-2 border-foreground bg-background p-5"
            key={card.key}
          >
            <p className="swiss-label text-muted-foreground">{card.label}</p>
            <p className="mt-6 font-black font-serif text-5xl leading-none tracking-[-0.04em]">
              {overview[card.valueKey]}
            </p>
          </article>
        ))}
      </section>

      <section className="mt-10 grid gap-6 border-foreground border-y-2 py-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div>
          <p className="swiss-label mb-3 text-accent">Waitlist operations</p>
          <h2 className="font-black font-serif text-3xl uppercase leading-none tracking-[-0.04em]">
            {overview.total} total requests
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground text-sm leading-relaxed">
            {overview.recent} joined in the last 7 days. Manage confirmations,
            grant access, and resend invite emails from the waitlist workspace.
          </p>
        </div>
        <Button asChild className="w-full lg:w-auto">
          <Link href="/waitlist">Open waitlist</Link>
        </Button>
      </section>
    </>
  )
}

function AdminOverviewFallback() {
  return (
    <output
      aria-busy="true"
      className="border-foreground border-t-4 pt-6 text-muted-foreground text-sm"
    >
      Loading admin overview&hellip;
    </output>
  )
}
