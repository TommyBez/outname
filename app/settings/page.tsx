import { Suspense } from "react"
import { requireSession, getSession } from "@/lib/auth-guard"
import { AppShell } from "@/components/app-shell"
import { TriggerButton } from "@/components/trigger-button"
import { GmailConnect } from "@/components/gmail-connect"
import { getGmailConnection } from "@/lib/google-oauth"
import { AccountSkeleton, GmailSectionSkeleton } from "@/components/skeletons"

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ gmail?: string; reason?: string }>
}) {
  await requireSession()
  const sp = await searchParams

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

      {sp.gmail === "error" ? (
        <div className="mb-10 border-l-2 border-destructive pl-4">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-destructive">
            Connection failed
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{sp.reason ?? "unknown error"}</p>
        </div>
      ) : null}
      {sp.gmail === "connected" ? (
        <div className="mb-10 border-l-2 border-foreground pl-4">
          <p className="font-serif text-lg font-medium">Gmail connected.</p>
        </div>
      ) : null}

      <div className="flex flex-col divide-y divide-border">
        <Section title="Gmail">
          <Suspense fallback={<GmailSectionSkeleton />}>
            <GmailSection />
          </Suspense>
        </Section>

        <Section title="Schedule">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
            <Row label="Daily run">
              <p className="font-serif text-xl font-medium tabular-nums">08:00</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Europe/Rome · weekdays included</p>
            </Row>
            <Row label="Manual">
              <TriggerButton variant="outline" />
            </Row>
          </div>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
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
      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <div>{children}</div>
    </div>
  )
}
