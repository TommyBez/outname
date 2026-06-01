'use client'

import { useRouter } from 'next/navigation'
import { InstallationsBlock } from './slack-bindings-panel/installations-block'
import type { InstallationView } from './slack-bindings-panel/types'
import { SlackComingSoonNotice } from './slack-coming-soon-notice'
import { SlackNotConfiguredNotice } from './slack-not-configured-notice'

export function SlackInstallationsPanel({
  installations,
  isAvailable,
  isConfigured,
}: {
  installations: InstallationView[]
  isAvailable: boolean
  isConfigured: boolean
}) {
  const { refresh } = useRouter()

  if (!isAvailable) {
    return <SlackComingSoonNotice />
  }

  if (!isConfigured) {
    return <SlackNotConfiguredNotice />
  }

  return (
    <InstallationsBlock
      installations={installations}
      installHref={slackInstallHref('/channels#slack')}
      onChanged={() => refresh()}
    />
  )
}

function slackInstallHref(returnTo: string): string {
  const params = new URLSearchParams({ returnTo })
  return `/api/channels/slack/install?${params.toString()}`
}
