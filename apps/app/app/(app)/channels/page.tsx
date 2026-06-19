import {
  hasSlackIntegrationAccess,
  requireSession,
} from '@outname/auth/server/auth-guard'
import { SlackInstallationsPanel } from '@outname/shared/channels/slack/components/slack-installations-panel'
import { listSlackInstallationsForUser } from '@outname/shared/channels/slack/server/bindings-query'
import { humanizeConnectionFlashReason } from '@outname/shared/connections/flash-reason'
import { createPrivatePageMetadata } from '@outname/shared/server/site-metadata'
import { ConnectionsSectionSkeleton } from '@outname/ui/components/skeletons'
import type { Metadata } from 'next'
import { Suspense } from 'react'

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
    <>
      <header className="mb-12 border-border border-t pt-6 md:mb-16">
        <h1 className="font-semibold text-3xl tracking-tight">Channels</h1>
        <p className="mt-5 max-w-2xl text-muted-foreground text-sm leading-relaxed">
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
    </>
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
      <div className="mb-10 border-destructive border-l bg-muted py-3 pl-4">
        <p className="font-bold text-destructive text-xs">
          Channel connection failed
        </p>
        <p className="mt-1 text-muted-foreground text-sm">
          {humanizeConnectionFlashReason(sp.reason)}
        </p>
        {sp.reason ? (
          <p className="mt-1 font-mono text-muted-foreground text-xs">
            Detail: {sp.reason}
          </p>
        ) : null}
      </div>
    )
  }
  if (sp.connection === 'connected') {
    return (
      <div className="mb-10 border-border border-l bg-muted py-3 pl-4">
        <p className="font-semibold font-serif text-lg tracking-[-0.04em]">
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
      className="border-border border-y py-8"
      id="slack"
    >
      <div className="mb-8 grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem] md:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2
              className="font-semibold text-xl tracking-tight"
              id="slack-channel-heading"
            >
              Slack
            </h2>
            {!isSlackAvailable && (
              <span className="inline-flex h-7 items-center border border-border bg-muted px-3 font-bold text-[10px]">
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
