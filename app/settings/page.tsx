import Link from 'next/link'
import { Suspense } from 'react'
import { AppShell } from '@/components/app-shell'
import { GmailConnect } from '@/components/gmail-connect'
import { AccountSkeleton, GmailSectionSkeleton } from '@/components/skeletons'
import { getSession, requireSession } from '@/lib/auth-guard'
import { getCachedAgentsForUser } from '@/lib/data'
import { getCachedGmailConnectionForUser } from '@/lib/google-oauth'

export default function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ gmail?: string; reason?: string }>
}) {
  return (
    <AppShell>
      <header className="mb-12 border-foreground border-t-4 pt-6 md:mb-16">
        <p className="swiss-label mb-4 text-accent">08. Settings</p>
        <h1 className="font-black font-serif text-6xl uppercase leading-[0.9] tracking-tighter md:text-8xl">
          Your assistant
        </h1>
      </header>

      <Suspense fallback={null}>
        <FlashNotice searchParams={searchParams} />
      </Suspense>

      <div className="border-foreground border-y-2">
        <Section title="Gmail">
          <Suspense fallback={<GmailSectionSkeleton />}>
            <GmailSection />
          </Suspense>
        </Section>

        <Section title="Agents">
          <Suspense fallback={<div className="h-10" />}>
            <AgentsSummarySection />
          </Suspense>
        </Section>

        <Section title="Account">
          <Suspense fallback={<AccountSkeleton />}>
            <AccountSection />
          </Suspense>
        </Section>
      </div>
    </AppShell>
  )
}

async function FlashNotice({
  searchParams,
}: {
  searchParams: Promise<{ gmail?: string; reason?: string }>
}) {
  const sp = await searchParams
  if (sp.gmail === 'error') {
    return (
      <div className="mb-10 border-destructive border-l-4 bg-muted py-3 pl-4">
        <p className="font-bold text-destructive text-xs uppercase tracking-[0.2em]">
          Connection failed
        </p>
        <p className="mt-1 text-muted-foreground text-sm">
          {sp.reason ?? 'unknown error'}
        </p>
      </div>
    )
  }
  if (sp.gmail === 'connected') {
    return (
      <div className="mb-10 border-foreground border-l-4 bg-muted py-3 pl-4">
        <p className="font-black font-serif text-lg uppercase tracking-[-0.04em]">
          Gmail connected.
        </p>
      </div>
    )
  }
  return null
}

async function GmailSection() {
  const session = await requireSession()
  const connectionRow = await getCachedGmailConnectionForUser(session.user.id)
  const connection = connectionRow
    ? {
        email: connectionRow.email,
        status: connectionRow.status,
        scopes: connectionRow.scopes,
        connectedAt: connectionRow.connectedAt.toISOString(),
        lastError: connectionRow.lastError,
      }
    : null
  return <GmailConnect connection={connection} />
}

async function AgentsSummarySection() {
  const session = await requireSession()
  const agents = await getCachedAgentsForUser(session.user.id)
  const enabled = agents.filter((a) => a.enabled).length
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div>
        <p className="font-black font-serif text-xl uppercase tracking-[-0.04em]">
          {agents.length} agent{agents.length === 1 ? '' : 's'} · {enabled}{' '}
          enabled
        </p>
        <p className="mt-0.5 text-muted-foreground text-xs">
          Per-agent configuration lives on each agent&apos;s page.
        </p>
      </div>
      <Link
        className="inline-flex h-11 shrink-0 items-center justify-center self-start border-2 border-foreground px-4 font-bold text-xs uppercase tracking-[0.16em] transition-colors hover:bg-foreground hover:text-background sm:self-auto"
        href="/agents"
      >
        Manage agents →
      </Link>
    </div>
  )
}

async function AccountSection() {
  const session = await getSession()
  return (
    <Row label="Signed in as">
      <p className="font-black font-serif text-xl uppercase leading-tight tracking-[-0.04em]">
        {session?.user.email ?? '—'}
      </p>
    </Row>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="grid grid-cols-1 gap-6 border-foreground border-b-2 py-10 last:border-b-0 lg:grid-cols-[160px_1fr] lg:gap-10">
      <h2 className="swiss-label text-accent">{title}</h2>
      <div className="min-w-0">{children}</div>
    </section>
  )
}

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-bold text-muted-foreground text-xs uppercase tracking-wider">
        {label}
      </p>
      <div>{children}</div>
    </div>
  )
}
