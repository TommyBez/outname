'use client'

import { useRouter } from 'next/navigation'
import { InstallationsBlock } from './slack-bindings-panel/installations-block'
import type { InstallationView } from './slack-bindings-panel/types'
import { SlackNotConfiguredNotice } from './slack-not-configured-notice'

export function SlackInstallationsPanel({
  installations,
  isConfigured,
}: {
  installations: InstallationView[]
  isConfigured: boolean
}) {
  const router = useRouter()

  if (!isConfigured) {
    return <SlackNotConfiguredNotice />
  }

  return (
    <InstallationsBlock
      installations={installations}
      installHref={slackInstallHref('/channels#slack')}
      onChanged={() => router.refresh()}
    />
  )
}

function slackInstallHref(returnTo: string): string {
  const params = new URLSearchParams({ returnTo })
  return `/api/channels/slack/install?${params.toString()}`
}
