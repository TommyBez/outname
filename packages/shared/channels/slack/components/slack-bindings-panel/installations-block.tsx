'use client'

import { disconnectSlackInstallationAction } from '@outname/shared/channels/slack/server/actions'
import { Button } from '@outname/ui/components/ui/button'
import { ConfirmActionDialog } from '@outname/ui/components/ui/confirm-action-dialog'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import type { InstallationView } from './types'

export function InstallationsBlock({
  installHref = '/api/channels/slack/install',
  installations,
  onChanged,
}: {
  installHref?: string
  installations: InstallationView[]
  onChanged: () => void
}) {
  async function disconnect(teamId: string) {
    const result = await disconnectSlackInstallationAction({ teamId })
    if (!result.ok) {
      throw new Error(result.error ?? 'Could not disconnect workspace.')
    }
    toast.success('Workspace disconnected.')
    onChanged()
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-bold text-xs">Installed workspaces</p>
      {installations.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No Slack workspaces installed yet. Install the Slack app to route
          channel and DM messages into your agents.
        </p>
      ) : (
        <ul className="flex flex-col divide-y-2 divide-foreground border-border border-y">
          {installations.map((install) => (
            <li
              className="flex items-center justify-between gap-3 py-3"
              key={install.teamId}
            >
              <div className="min-w-0">
                <p className="truncate font-bold text-sm">
                  {install.workspaceName ?? install.teamId}
                </p>
                <p className="truncate font-mono text-muted-foreground text-xs">
                  {install.teamId}
                </p>
              </div>
              <ConfirmActionDialog
                confirmLabel="Disconnect workspace"
                description={
                  <>
                    Disconnecting{' '}
                    <strong>{install.workspaceName ?? install.teamId}</strong>{' '}
                    stops all Slack bindings in this workspace from routing
                    messages to your agents. You can reinstall the app later to
                    reconnect.
                  </>
                }
                onConfirm={() => disconnect(install.teamId)}
                title="Disconnect this workspace?"
                trigger={
                  <Button
                    className="inline-flex h-9 items-center justify-center border border-border px-3 font-bold text-xs transition-colors hover:bg-destructive hover:text-background disabled:opacity-50"
                    size="xs"
                    type="button"
                    variant="outline"
                  >
                    Disconnect
                  </Button>
                }
              />
            </li>
          ))}
        </ul>
      )}
      <a
        className="inline-flex h-10 w-fit items-center gap-2 border border-border bg-foreground px-4 font-bold text-background text-xs transition-colors hover:bg-background hover:text-foreground"
        href={installHref}
      >
        <Plus aria-hidden className="size-3.5" />
        {installations.length === 0 ? 'Install Slack app' : 'Add workspace'}
      </a>
    </div>
  )
}
