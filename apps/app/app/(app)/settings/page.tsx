import {
  getSession,
  hasWaitlistManageAccess,
  requireSession,
} from '@outname/auth/server/auth-guard'
import {
  BudgetRules,
  type BudgetRuleView,
} from '@outname/shared/budgets/components/budget-rules'
import { listGeneralBudgetRulesForUser } from '@outname/shared/budgets/server/rules'
import { sumSpendUsd } from '@outname/shared/budgets/server/spend'
import { getCachedAgentsForUser } from '@outname/shared/server/data'
import {
  displayInferenceProvider,
  inferenceProviderKeyPlaceholder,
  listUserInferenceProviderStates,
} from '@outname/shared/server/inference-providers'
import { createPrivatePageMetadata } from '@outname/shared/server/site-metadata'
import { getUserTimezone } from '@outname/shared/server/user-timezone'
import { AccountSkeleton } from '@outname/ui/components/skeletons'
import { Button } from '@outname/ui/components/ui/button'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { InferenceProvidersCard } from './inference-providers-card'
import { TimezoneCard } from './timezone-card'

export const metadata: Metadata = createPrivatePageMetadata(
  'Settings',
  'Manage OUTNA.ME account settings, budget, and agent defaults.'
)

export default function SettingsPage() {
  return (
    <>
      <header className="mb-12 pt-6 md:mb-16">
        <h1 className="font-semibold text-3xl tracking-tight">
          Your assistant
        </h1>
      </header>

      <div className="border-border border-b">
        <Section title="Budget">
          <Suspense fallback={<div className="h-32" />}>
            <BudgetSection />
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

        <Section title="Timezone">
          <Suspense fallback={<div className="h-24" />}>
            <TimezoneSection />
          </Suspense>
        </Section>

        <Section title="Inference providers">
          <Suspense fallback={<div className="h-10" />}>
            <InferenceProvidersSection />
          </Suspense>
        </Section>

        <Suspense fallback={null}>
          <WaitlistAdminSection />
        </Suspense>
      </div>
    </>
  )
}

async function InferenceProvidersSection() {
  const session = await requireSession()
  const providers = await listUserInferenceProviderStates(session.user.id)
  return (
    <InferenceProvidersCard
      providers={providers.map((provider) => ({
        ...provider,
        keyPlaceholder: inferenceProviderKeyPlaceholder(
          provider.inferenceProvider
        ),
        label: displayInferenceProvider(provider.inferenceProvider),
        verifiedAt: provider.verifiedAt?.toISOString() ?? null,
      }))}
    />
  )
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
        <p className="font-semibold font-serif text-xl tracking-[-0.04em]">
          {agents.length} agent{agents.length === 1 ? '' : 's'} · {enabled}{' '}
          enabled
        </p>
        <p className="mt-0.5 text-muted-foreground text-xs">
          Per-agent configuration lives on each agent&apos;s page.
        </p>
      </div>
      <Button
        asChild
        className="shrink-0 self-start sm:self-auto"
        variant="outline"
      >
        <Link href="/agents">Manage agents →</Link>
      </Button>
    </div>
  )
}

async function AccountSection() {
  const session = await getSession()
  return (
    <Row label="Signed in as">
      <p className="font-semibold font-serif text-xl leading-tight tracking-[-0.04em]">
        {session?.user.email ?? '—'}
      </p>
    </Row>
  )
}

async function TimezoneSection() {
  const session = await requireSession()
  const timezone = await getUserTimezone(session.user.id)
  return <TimezoneCard timezone={timezone} />
}

async function WaitlistAdminSection() {
  const session = await getSession()
  if (!(session && (await hasWaitlistManageAccess(session.user.id)))) {
    return null
  }

  return (
    <Section title="Waitlist">
      <WaitlistSection />
    </Section>
  )
}

function WaitlistSection() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div>
        <p className="font-semibold font-serif text-xl tracking-[-0.04em]">
          Invite users and manage the waitlist
        </p>
        <p className="mt-0.5 text-muted-foreground text-xs">
          Send product invites by email, review signups, and resend confirmation
          or access messages.
        </p>
      </div>
      <Button
        asChild
        className="shrink-0 self-start sm:self-auto"
        variant="outline"
      >
        <Link href="/settings/waitlist">Open waitlist →</Link>
      </Button>
    </div>
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
    <section className="grid grid-cols-1 gap-6 border-border border-b py-10 last:border-b-0 lg:grid-cols-[160px_1fr] lg:gap-10">
      <h2 className="swiss-label text-muted-foreground">{title}</h2>
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
      <p className="font-bold text-muted-foreground text-xs tracking-wider">
        {label}
      </p>
      <div>{children}</div>
    </div>
  )
}
