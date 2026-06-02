'use client'

import { deleteSlackBindingAction } from '@outname/shared/channels/slack/server/actions'
import { Hash, Trash2, User as UserIcon } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import type { InstallationView, SlackBindingView } from './types'
import { KIND_LABEL, workspaceLabel } from './utils'

export function BindingsBlock({
  agentId,
  bindings,
  installations,
  onChanged,
}: {
  agentId: string
  bindings: SlackBindingView[]
  installations: InstallationView[]
  onChanged: () => void
}) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function remove(bindingId: string) {
    setPendingId(bindingId)
    startTransition(async () => {
      const result = await deleteSlackBindingAction({
        agentId,
        bindingId,
      })
      setPendingId(null)
      if (!result.ok) {
        toast.error(result.error ?? 'Could not remove binding.')
        return
      }
      toast.success('Binding removed.')
      onChanged()
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-bold text-xs uppercase tracking-[0.16em]">
        Routing bindings
      </p>
      {bindings.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No Slack messages route to this agent yet. Add a binding below to
          route a channel or DM.
        </p>
      ) : (
        <ul className="flex flex-col divide-y-2 divide-foreground border-foreground border-y-2">
          {bindings.map((binding) => (
            <BindingRow
              binding={binding}
              disabled={pending && pendingId === binding.id}
              key={binding.id}
              onRemove={() => remove(binding.id)}
            />
          ))}
        </ul>
      )}
      {bindings.length > 0 && installations.length === 0 && (
        <p className="text-destructive text-xs">
          One or more bindings reference a workspace you no longer have
          installed, they will be ignored until you reinstall.
        </p>
      )}
    </div>
  )
}

function BindingRow({
  binding,
  disabled,
  onRemove,
}: {
  binding: SlackBindingView
  disabled: boolean
  onRemove: () => void
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <BindingIcon kind={binding.kind} />
        <div className="min-w-0">
          <p className="font-bold text-sm">
            {KIND_LABEL[binding.kind]}{' '}
            <span className="font-mono font-normal text-muted-foreground">
              {binding.externalKey}
            </span>
          </p>
          <p className="truncate text-muted-foreground text-xs">
            {workspaceLabel({
              teamId: binding.teamId,
              workspaceName: binding.workspaceName,
            })}
            {!binding.installed && (
              <span className="ml-2 inline-flex items-center gap-1 font-bold text-destructive uppercase tracking-[0.12em]">
                Workspace not installed
              </span>
            )}
          </p>
        </div>
      </div>
      <button
        aria-label="Remove binding"
        className="inline-flex size-9 items-center justify-center border-2 border-foreground transition-colors hover:bg-destructive hover:text-background disabled:opacity-50"
        disabled={disabled}
        onClick={onRemove}
        type="button"
      >
        <Trash2 aria-hidden className="size-3.5" />
      </button>
    </li>
  )
}

function BindingIcon({ kind }: { kind: SlackBindingView['kind'] }) {
  if (kind === 'channel') {
    return <Hash aria-hidden className="size-4 shrink-0" />
  }
  return <UserIcon aria-hidden className="size-4 shrink-0" />
}
