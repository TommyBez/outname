'use client'

import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { AddBindingForm } from './slack-bindings-panel/add-binding-form'
import { BindingsBlock } from './slack-bindings-panel/bindings-block'
import { InstallationsBlock } from './slack-bindings-panel/installations-block'
import type {
  InstallationView,
  SlackBindingsPanelProps as SlackBindingsPanelPropsType,
} from './slack-bindings-panel/types'
import { SlackComingSoonNotice } from './slack-coming-soon-notice'
import { SlackNotConfiguredNotice } from './slack-not-configured-notice'

export type { SlackBindingsPanelProps } from './slack-bindings-panel/types'

export function SlackBindingsPanel({
  agentId,
  bindings,
  installations,
  isAvailable,
  isConfigured,
}: SlackBindingsPanelPropsType) {
  const { refresh } = useRouter()
  const [showForm, setShowForm] = useState(false)
  const workspaceOptions = useMemo<InstallationView[]>(
    () => installations,
    [installations]
  )
  const canBind = workspaceOptions.length > 0

  if (!isAvailable) {
    return <SlackComingSoonNotice />
  }

  return (
    <div className="flex flex-col gap-6">
      {!isConfigured && <SlackNotConfiguredNotice />}

      {isConfigured && (
        <InstallationsBlock
          installations={installations}
          installHref={slackInstallHref(
            `/agents/${agentId}/configure#integrations`
          )}
          onChanged={() => refresh()}
        />
      )}

      <BindingsBlock
        agentId={agentId}
        bindings={bindings}
        installations={installations}
        onChanged={() => refresh()}
      />

      {isConfigured && (
        <div>
          {showForm ? (
            <AddBindingForm
              agentId={agentId}
              onCancel={() => setShowForm(false)}
              onSaved={() => {
                setShowForm(false)
                refresh()
              }}
              workspaces={workspaceOptions}
            />
          ) : (
            <button
              className="inline-flex h-10 items-center gap-2 border-2 border-foreground px-4 font-bold text-xs uppercase tracking-[0.16em] transition-colors hover:bg-foreground hover:text-background disabled:opacity-50"
              disabled={!canBind}
              onClick={() => setShowForm(true)}
              title={
                canBind ? undefined : 'Install the Slack app to add a binding.'
              }
              type="button"
            >
              <Plus aria-hidden className="size-3.5" />
              Add Slack binding
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function slackInstallHref(returnTo: string): string {
  const params = new URLSearchParams({ returnTo })
  return `/api/channels/slack/install?${params.toString()}`
}
