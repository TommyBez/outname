'use client'

import { disconnectSlackInstallationAction } from '@outname/shared/channels/slack/server/actions'
import { Plus } from 'lucide-react'
import { useState, useTransition } from 'react'
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
  const [pending, startTransition] = useTransition()
  const [pendingTeamId, setPendingTeamId] = useState<string | null>(null)

  function disconnect(teamId: string) {
    setPendingTeamId(teamId)
    startTransition(async () => {
      const result = await disconnectSlackInstallationAction({ teamId })
      setPendingTeamId(null)
      if (!result.ok) {
        toast.error(result.error ?? 'Could not disconnect workspace.')
        return
      }
      toast.success('Workspace disconnected.')
      onChanged()
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-bold text-xs uppercase tracking-[0.16em]">
        Installed workspaces
      </p>
      {installations.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No Slack workspaces installed yet for your account.
        </p>
      ) : (
        <ul className="flex flex-col divide-y-2 divide-foreground border-foreground border-y-2">
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
              <button
                className="inline-flex h-9 items-center justify-center border-2 border-foreground px-3 font-bold text-xs uppercase tracking-[0.16em] transition-colors hover:bg-destructive hover:text-background disabled:opacity-50"
                disabled={pending && pendingTeamId === install.teamId}
                onClick={() => disconnect(install.teamId)}
                type="button"
              >
                {pending && pendingTeamId === install.teamId
                  ? '…'
                  : 'Disconnect'}
              </button>
            </li>
          ))}
        </ul>
      )}
      <a
        className="inline-flex h-10 w-fit items-center gap-2 border-2 border-foreground bg-foreground px-4 font-bold text-background text-xs uppercase tracking-[0.16em] transition-colors hover:bg-background hover:text-foreground"
        href={installHref}
      >
        <Plus aria-hidden className="size-3.5" />
        {installations.length === 0 ? 'Install Slack app' : 'Add workspace'}
      </a>
    </div>
  )
}
