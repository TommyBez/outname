'use client'

import { X } from 'lucide-react'
import type { FormEvent } from 'react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { upsertSlackBindingAction } from '@/channels/slack/server/actions'
import type { InstallationView, SlackBindingView } from './types'
import { workspaceLabel } from './utils'

export function AddBindingForm({
  agentId,
  isMultiWorkspace,
  onCancel,
  onSaved,
  workspaces,
}: {
  agentId: string
  isMultiWorkspace: boolean
  onCancel: () => void
  onSaved: () => void
  workspaces: InstallationView[]
}) {
  const [pending, startTransition] = useTransition()
  const [kind, setKind] = useState<SlackBindingView['kind']>('channel')
  const [teamId, setTeamId] = useState<string>(workspaces[0]?.teamId ?? '')
  const [externalKey, setExternalKey] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const result = await upsertSlackBindingAction({
        agentId,
        teamId,
        kind,
        externalKey: kind === 'default' ? '' : externalKey.trim(),
      })
      if (!result.ok) {
        toast.error(result.error ?? 'Could not save binding.')
        return
      }
      toast.success('Binding saved.')
      onSaved()
    })
  }

  const externalKeyLabel = kind === 'channel' ? 'Channel id' : 'Slack user id'
  const externalKeyPlaceholder =
    kind === 'channel' ? 'C0123456789' : 'U0123456789'

  return (
    <form
      className="flex flex-col gap-4 border-2 border-foreground bg-muted p-4"
      onSubmit={handleSubmit}
    >
      <div className="flex items-center justify-between">
        <p className="font-bold text-xs uppercase tracking-[0.16em]">
          New Slack binding
        </p>
        <button
          aria-label="Cancel"
          className="inline-flex h-7 w-7 items-center justify-center border-2 border-foreground hover:bg-foreground hover:text-background"
          onClick={onCancel}
          type="button"
        >
          <X aria-hidden className="size-3.5" />
        </button>
      </div>

      <WorkspaceSelect
        disabled={!isMultiWorkspace}
        onChange={setTeamId}
        teamId={teamId}
        workspaces={workspaces}
      />

      <KindSelect kind={kind} onChange={setKind} />

      {kind !== 'default' && (
        <ExternalKeyField
          kind={kind}
          label={externalKeyLabel}
          onChange={setExternalKey}
          placeholder={externalKeyPlaceholder}
          value={externalKey}
        />
      )}

      <div className="flex items-center gap-2">
        <button
          className="inline-flex h-10 items-center justify-center border-2 border-foreground bg-foreground px-4 font-bold text-background text-xs uppercase tracking-[0.16em] transition-colors hover:bg-background hover:text-foreground disabled:opacity-50"
          disabled={pending}
          type="submit"
        >
          {pending ? 'Saving…' : 'Save binding'}
        </button>
        <button
          className="inline-flex h-10 items-center justify-center border-2 border-foreground px-4 font-bold text-xs uppercase tracking-[0.16em] transition-colors hover:bg-foreground hover:text-background"
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

function WorkspaceSelect({
  disabled,
  onChange,
  teamId,
  workspaces,
}: {
  disabled: boolean
  onChange: (teamId: string) => void
  teamId: string
  workspaces: InstallationView[]
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-bold text-[10px] uppercase tracking-[0.2em]">
        Workspace
      </span>
      <select
        className="h-10 w-full border-2 border-foreground bg-background px-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        value={teamId}
      >
        {workspaces.map((workspace) => (
          <option key={workspace.teamId} value={workspace.teamId}>
            {workspaceLabel(workspace)}
          </option>
        ))}
      </select>
    </label>
  )
}

function KindSelect({
  kind,
  onChange,
}: {
  kind: SlackBindingView['kind']
  onChange: (kind: SlackBindingView['kind']) => void
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-bold text-[10px] uppercase tracking-[0.2em]">
        Routing kind
      </span>
      <select
        className="h-10 w-full border-2 border-foreground bg-background px-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        onChange={(event) =>
          onChange(event.target.value as SlackBindingView['kind'])
        }
        value={kind}
      >
        <option value="channel">
          Channel — route a public/private channel
        </option>
        <option value="dm">Direct message — route DMs from one user</option>
        <option value="default">Workspace fallback — any unbound thread</option>
      </select>
    </label>
  )
}

function ExternalKeyField({
  kind,
  label,
  onChange,
  placeholder,
  value,
}: {
  kind: SlackBindingView['kind']
  label: string
  onChange: (value: string) => void
  placeholder: string
  value: string
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-bold text-[10px] uppercase tracking-[0.2em]">
        {label}
      </span>
      <input
        className="h-10 w-full border-2 border-foreground bg-background px-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required
        type="text"
        value={value}
      />
      <span className="text-muted-foreground text-xs">
        {kind === 'channel'
          ? 'Find a channel id from Slack → channel → ⓘ → "Copy channel ID".'
          : 'Find a user id from a Slack profile → ⋮ → "Copy member ID".'}
      </span>
    </label>
  )
}
