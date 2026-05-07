import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { AppShell } from '@/components/app-shell'
import { BudgetRules, type BudgetRuleView } from '@/components/budget-rules'
import { ConnectionsList } from '@/components/connections-list'
import {
  AccountSkeleton,
  ConnectionsSectionSkeleton,
} from '@/components/skeletons'
import { listConnectors } from '@/connectors/registry'
import { getSession, requireSession } from '@/lib/auth-guard'
import { listGeneralBudgetRulesForUser, sumSpendUsd } from '@/lib/budget'
import { getCachedAgentsForUser, getCachedUserConnections } from '@/lib/data'
import { createPrivatePageMetadata } from '@/lib/site-metadata'

export const metadata: Metadata = createPrivatePageMetadata(
  'Settings',
  'Manage OUTNA.ME account settings, connected tools, and agent configuration.'
)

export default function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connection?: string; reason?: string }>
}) {
  return (
    <AppShell>
      <header className="mb-10 border-foreground border-t-4 pt-6 md:mb-12">
        <p className="swiss-label mb-4 text-accent">08. Settings</p>
        <h1 className="font-black font-serif text-6xl uppercase leading-[0.9] tracking-tighter md:text-8xl">
          Workspace
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground text-sm">
          Account-wide setup. Provider connections and the general budget apply
          to every agent. Per-agent overrides — Slack channels, budget caps,
          tools — live on each agent&apos;s Configure page.
        </p>
      </header>

      <Suspense fallback={null}>
        <FlashNotice searchParams={searchParams} />
      </Suspense>

      <SettingsSectionNav />

      <div className="border-foreground border-y-2">
        <Section
          description="OAuth and API key credentials your agents share. Connect once, then enable the matching tool on any agent."
          id="connections"
          title="Connections"
        >
          <Suspense fallback={<ConnectionsSectionSkeleton />}>
            <ConnectionsSection />
          </Suspense>
        </Section>

        <Section
          description="Default daily, weekly, and monthly caps that apply to every agent unless an agent sets its own override."
          id="budget"
          title="General budget"
        >
          <Suspense fallback={<div className="h-32" />}>
            <BudgetSection />
          </Suspense>
        </Section>

        <Section
          description="Slack workspace install plus the agents you have. Channel bindings live on each agent's Configure → Channels."
          id="channels"
          title="Channels & agents"
        >
          <Suspense fallback={<div className="h-10" />}>
            <AgentsSummarySection />
          </Suspense>
        </Section>

        <Section id="account" title="Account">
          <Suspense fallback={<AccountSkeleton />}>
            <AccountSection />
          </Suspense>
        </Section>
      </div>
    </AppShell>
  )
}

const SETTINGS_NAV_ITEMS = [
  { href: '#connections', label: 'Connections' },
  { href: '#budget', label: 'General budget' },
  { href: '#channels', label: 'Channels & agents' },
  { href: '#account', label: 'Account' },
] as const

function SettingsSectionNav() {
  return (
    <nav
      aria-label="Settings sections"
      className="mb-8 flex flex-wrap gap-2 border-foreground border-y-2 py-3"
    >
      {SETTINGS_NAV_ITEMS.map((item) => (
        <a
          className="inline-flex h-8 items-center px-3 font-bold text-[10px] text-muted-foreground uppercase tracking-[0.18em] transition-colors hover:bg-foreground hover:text-background"
          href={item.href}
          key={item.href}
        >
          {item.label}
        </a>
      ))}
    </nav>
  )
}

async function FlashNotice({
  searchParams,
}: {
  searchParams: Promise<{ connection?: string; reason?: string }>
}) {
  const sp = await searchParams
  if (sp.connection === 'error') {
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
  if (sp.connection === 'connected') {
    return (
      <div className="mb-10 border-foreground border-l-4 bg-muted py-3 pl-4">
        <p className="font-black font-serif text-lg uppercase tracking-[-0.04em]">
          Connection saved.
        </p>
      </div>
    )
  }
  return null
}

async function ConnectionsSection() {
  const session = await requireSession()
  const rows = await getCachedUserConnections(session.user.id)

  const connectors = listConnectors().map((c) => ({
    provider: c.provider,
    kind: c.kind,
    displayName: c.displayName,
    description: c.description,
    apiKeyFields: c.kind === 'api_key' ? c.apiKey.fields : undefined,
  }))

  const connections = rows.map((r) => ({
    provider: r.provider,
    status: r.status as 'active' | 'invalid',
    metadata: (r.metadata ?? {}) as Record<string, unknown>,
    lastError: r.lastError,
    connectedAt: r.createdAt.toISOString(),
  }))

  return <ConnectionsList connections={connections} connectors={connectors} />
}

async function BudgetSection() {
  const session = await requireSession()
  const rules = await listGeneralBudgetRulesForUser(session.user.id)
  const views: BudgetRuleView[] = await Promise.all(
    rules.map(async (r) => ({
      id: r.id,
      agentId: null,
      agentName: null,
      period: r.period,
      limitUsd: Number(r.limitUsd),
      enabled: r.enabled,
      spentUsd: await sumSpendUsd({
        userId: session.user.id,
        scope: { type: 'general' },
        period: r.period,
      }),
    }))
  )
  return <BudgetRules rules={views} scope={{ type: 'general' }} />
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
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section
      className="scroll-mt-24 grid grid-cols-1 gap-6 border-foreground border-b-2 py-10 last:border-b-0 lg:grid-cols-[200px_1fr] lg:gap-10"
      id={id}
    >
      <div className="flex flex-col gap-3">
        <h2 className="swiss-label text-accent">{title}</h2>
        {description ? (
          <p className="text-muted-foreground text-xs leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
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
