import { Suspense } from "react"
import Link from "next/link"
import { getSession, requireSession } from "@/lib/auth-guard"
import { AppShell } from "@/components/app-shell"
import { GmailConnect } from "@/components/gmail-connect"
import { TimezonePicker } from "@/components/timezone-picker"
import { getGmailConnection } from "@/lib/google-oauth"
import { getUserSettings, getAgentsForUser } from "@/lib/data"
import { AccountSkeleton, GmailSectionSkeleton } from "@/components/skeletons"

export default function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ gmail?: string; reason?: string }>
}) {
  return (
    <AppShell>
      <header className="mb-12 flex flex-col gap-2 md:mb-16">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Settings
        </p>
        <h1 className="font-serif text-4xl font-medium leading-tight tracking-tight md:text-5xl">
          Your assistant.
        </h1>
      </header>

      <Suspense fallback={null}>
        <FlashNotice searchParams={searchParams} />
      </Suspense>

      <div className="flex flex-col divide-y divide-border">
        <Section title="Gmail">
          <Suspense fallback={<GmailSectionSkeleton />}>
            <GmailSection />
          </Suspense>
        </Section>

        <Section title="Timezone">
          <Suspense fallback={<div className="h-10" />}>
            <TimezoneSection />
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
  if (sp.gmail === "error") {
    return (
      <div className="mb-10 border-l-2 border-destructive pl-4">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-destructive">
          Connection failed
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {sp.reason ?? "unknown error"}
        </p>
      </div>
    )
  }
  if (sp.gmail === "connected") {
    return (
      <div className="mb-10 border-l-2 border-foreground pl-4">
        <p className="font-serif text-lg font-medium">Gmail connected.</p>
      </div>
    )
  }
  return null
}

async function GmailSection() {
  const connectionRow = await getGmailConnection()
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

async function TimezoneSection() {
  const session = await requireSession()
  const settings = await getUserSettings(session.user.id)
  return <TimezonePicker current={settings?.timezone ?? "UTC"} />
}

async function AgentsSummarySection() {
  const session = await requireSession()
  const agents = await getAgentsForUser(session.user.id)
  const enabled = agents.filter((a) => a.enabled).length
  return (
    <div className="flex items-center justify-between gap-6">
      <div>
        <p className="font-serif text-xl font-medium">
          {agents.length} agent{agents.length === 1 ? "" : "s"} · {enabled}{" "}
          enabled
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Scheduling and per-agent configuration live on each agent&apos;s
          page.
        </p>
      </div>
      <Link
        href="/agents"
        className="inline-flex shrink-0 items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
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
      <p className="font-serif text-xl font-medium leading-tight">
        {session?.user.email ?? "—"}
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
    <section className="grid grid-cols-1 gap-6 py-10 first:pt-0 last:pb-0 md:grid-cols-[180px_1fr] md:gap-12">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {title}
      </h2>
      <div>{children}</div>
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div>{children}</div>
    </div>
  )
}
