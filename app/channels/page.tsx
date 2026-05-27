import type { Metadata } from 'next'
import { Suspense } from 'react'
import {
  hasSlackIntegrationAccess,
  requireSession,
} from '@/auth/server/auth-guard'
import { SlackInstallationsPanel } from '@/channels/slack/components/slack-installations-panel'
import { listSlackInstallationsForUser } from '@/channels/slack/server/bindings-query'
import { AppShell } from '@/shared/components/layout/app-shell'
import { ConnectionsSectionSkeleton } from '@/shared/components/skeletons'
import { createPrivatePageMetadata } from '@/shared/server/site-metadata'

export const metadata: Metadata = createPrivatePageMetadata(
  'Channels',
  'Manage external chat channels that can route messages into OUTNA.ME agents.'
)

export default function ChannelsPage({
  searchParams,
}: {
  searchParams: Promise<{ connection?: string; reason?: string }>
}) {
  return (
    <AppShell>
      <header className="mb-12 border-foreground border-t-4 pt-6 md:mb-16">
        <p className="swiss-label mb-4 text-accent">08. Channels</p>
        <h1 className="font-black font-serif text-5xl uppercase leading-[0.9] tracking-tighter sm:text-6xl lg:text-7xl xl:text-8xl">
          Channels
        </h1>
        <p className="mt-5 max-w-2xl border-foreground border-l-2 pl-4 text-muted-foreground text-sm leading-relaxed">
          External chat surfaces that can send work into agents. Install a
          channel provider here, then bind specific workspaces, channels, or DMs
          from an agent workspace.
        </p>
      </header>

      <Suspense fallback={null}>
        <ChannelFlashNotice searchParams={searchParams} />
      </Suspense>

      <Suspense fallback={<ConnectionsSectionSkeleton />}>
        <ChannelsSection />
      </Suspense>
    </AppShell>
  )
}

async function ChannelFlashNotice({
  searchParams,
}: {
  searchParams: Promise<{ connection?: string; reason?: string }>
}) {
  const sp = await searchParams
  if (sp.connection === 'error') {
    return (
      <div className="mb-10 border-destructive border-l-4 bg-muted py-3 pl-4">
        <p className="font-bold text-destructive text-xs uppercase tracking-[0.2em]">
          Channel connection failed
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
          Channel connected.
        </p>
      </div>
    )
  }
  return null
}

async function ChannelsSection() {
  const session = await requireSession()
  const isSlackAvailable = await hasSlackIntegrationAccess(session.user.id)
  const installations = isSlackAvailable
    ? await listSlackInstallationsForUser(session.user.id)
    : []
  const isSlackConfigured = Boolean(
    process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET
  )

  return (
    <section
      aria-labelledby="slack-channel-heading"
      className="border-foreground border-y-2 py-8"
      id="slack"
    >
      <div className="mb-8 grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem] md:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2
              className="font-black font-serif text-3xl uppercase leading-none tracking-tighter"
              id="slack-channel-heading"
            >
              Slack
            </h2>
            {!isSlackAvailable && (
              <span className="inline-flex h-7 items-center border-2 border-foreground bg-muted px-3 font-bold text-[10px] uppercase tracking-[0.16em]">
                Coming soon
              </span>
            )}
          </div>
          <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
            Install the Slack app once per workspace. Agent-specific routing
            stays in each agent&apos;s Configure / Integrations section.
          </p>
        </div>
        {isSlackAvailable && (
          <p className="font-mono text-muted-foreground text-xs md:text-right">
            {installations.length} installed
          </p>
        )}
      </div>

      <SlackInstallationsPanel
        installations={installations}
        isAvailable={isSlackAvailable}
        isConfigured={isSlackConfigured}
      />
    </section>
  )
}
