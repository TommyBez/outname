'use client'

import { upsertSlackBindingAction } from '@outname/shared/channels/slack/server/actions'
import { Button } from '@outname/ui/components/ui/button'
import { X } from 'lucide-react'
import type { FormEvent } from 'react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import type { InstallationView } from './types'
import { workspaceLabel } from './utils'

type NewBindingKind = 'channel' | 'dm'

export function AddBindingForm({
  agentId,
  onCancel,
  onSaved,
  workspaces,
}: {
  agentId: string
  onCancel: () => void
  onSaved: () => void
  workspaces: InstallationView[]
}) {
  const [pending, startTransition] = useTransition()
  const [kind, setKind] = useState<NewBindingKind>('channel')
  const [teamId, setTeamId] = useState<string>(workspaces[0]?.teamId ?? '')
  const [externalKey, setExternalKey] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const result = await upsertSlackBindingAction({
        agentId,
        teamId,
        kind,
        externalKey: externalKey.trim(),
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
      className="flex flex-col gap-4 border border-border bg-muted p-4"
      onSubmit={handleSubmit}
    >
      <div className="flex items-center justify-between">
        <p className="font-bold text-xs">New Slack binding</p>
        <Button
          aria-label="Cancel"
          onClick={onCancel}
          size="icon-xs"
          type="button"
          variant="outline"
        >
          <X aria-hidden className="size-3.5" />
        </Button>
      </div>

      <WorkspaceSelect
        onChange={setTeamId}
        teamId={teamId}
        workspaces={workspaces}
      />

      <KindSelect kind={kind} onChange={setKind} />

      <ExternalKeyField
        kind={kind}
        label={externalKeyLabel}
        onChange={setExternalKey}
        placeholder={externalKeyPlaceholder}
        value={externalKey}
      />

      <div className="flex items-center gap-2">
        <Button disabled={pending} size="sm" type="submit">
          {pending ? 'Saving…' : 'Save binding'}
        </Button>
        <Button onClick={onCancel} size="sm" type="button" variant="outline">
          Cancel
        </Button>
      </div>
    </form>
  )
}

function WorkspaceSelect({
  onChange,
  teamId,
  workspaces,
}: {
  onChange: (teamId: string) => void
  teamId: string
  workspaces: InstallationView[]
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-bold text-[10px]">Workspace</span>
      <select
        className="h-10 w-full border border-border bg-background px-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent"
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
  kind: NewBindingKind
  onChange: (kind: NewBindingKind) => void
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-bold text-[10px]">Routing kind</span>
      <select
        className="h-10 w-full border border-border bg-background px-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        onChange={(event) => onChange(event.target.value as NewBindingKind)}
        value={kind}
      >
        <option value="channel">Channel, route a public/private channel</option>
        <option value="dm">Direct message, route DMs from one user</option>
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
  kind: NewBindingKind
  label: string
  onChange: (value: string) => void
  placeholder: string
  value: string
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-bold text-[10px]">{label}</span>
      <input
        aria-label={label}
        className="h-10 w-full border border-border bg-background px-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent"
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
