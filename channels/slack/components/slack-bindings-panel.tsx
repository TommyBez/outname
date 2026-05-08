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

export type { SlackBindingsPanelProps } from './slack-bindings-panel/types'

export function SlackBindingsPanel({
  agentId,
  bindings,
  installations,
  isMultiWorkspace,
  isConfigured,
}: SlackBindingsPanelPropsType) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const workspaceOptions = useMemo<InstallationView[]>(() => {
    if (isMultiWorkspace) {
      return installations
    }
    return [{ teamId: '', workspaceName: null }]
  }, [installations, isMultiWorkspace])
  const canBind = workspaceOptions.length > 0

  return (
    <div className="flex flex-col gap-6">
      {!isConfigured && <SlackNotConfiguredNotice />}

      {isConfigured && (
        <InstallationsBlock
          installations={installations}
          isMultiWorkspace={isMultiWorkspace}
          onChanged={() => router.refresh()}
        />
      )}

      <BindingsBlock
        agentId={agentId}
        bindings={bindings}
        installations={installations}
        isMultiWorkspace={isMultiWorkspace}
        onChanged={() => router.refresh()}
      />

      {isConfigured && (
        <div>
          {showForm ? (
            <AddBindingForm
              agentId={agentId}
              isMultiWorkspace={isMultiWorkspace}
              onCancel={() => setShowForm(false)}
              onSaved={() => {
                setShowForm(false)
                router.refresh()
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

function SlackNotConfiguredNotice() {
  return (
    <p className="border-2 border-foreground bg-muted px-4 py-3 text-sm">
      Slack is not configured on this deployment. Set{' '}
      <code className="font-mono">SLACK_CLIENT_ID</code>,{' '}
      <code className="font-mono">SLACK_CLIENT_SECRET</code>, and{' '}
      <code className="font-mono">SLACK_SIGNING_SECRET</code> (or the
      single-workspace token pair) and redeploy.
    </p>
  )
}
