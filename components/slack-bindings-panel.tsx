'use client'

import { Hash, Plus, Trash2, User as UserIcon, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  deleteSlackBindingAction,
  disconnectSlackInstallationAction,
  upsertSlackBindingAction,
} from '@/lib/channels/slack-actions'
import type {
  SlackBindingView,
  SlackInstallationView,
} from '@/lib/channels/slack-bindings-query'

type InstallationView = SlackInstallationView

export interface SlackBindingsPanelProps {
  agentId: string
  bindings: SlackBindingView[]
  installations: InstallationView[]
  /** When neither multi nor single mode is configured, the bot is off. */
  isConfigured: boolean
  /** Multi-workspace deployments expose `/api/channels/slack/install`. */
  isMultiWorkspace: boolean
}

const KIND_LABEL: Record<SlackBindingView['kind'], string> = {
  channel: 'Channel',
  dm: 'Direct message',
  default: 'Workspace fallback',
}

function describeBindingTarget(binding: SlackBindingView): string {
  if (binding.kind === 'default') {
    return 'Any unbound thread'
  }
  return binding.externalKey
}

function workspaceLabel(input: {
  teamId: string
  workspaceName: string | null
}): string {
  if (input.teamId === '') {
    return 'Single-workspace install'
  }
  if (input.workspaceName) {
    return `${input.workspaceName} (${input.teamId})`
  }
  return input.teamId
}

export function SlackBindingsPanel({
  agentId,
  bindings,
  installations,
  isMultiWorkspace,
  isConfigured,
}: SlackBindingsPanelProps) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)

  // In single-workspace mode there is no install row, so synthesize a
  // pseudo "workspace" with teamId = '' so the picker still has a
  // selectable option.
  const workspaceOptions = useMemo<InstallationView[]>(() => {
    if (isMultiWorkspace) {
      return installations
    }
    return [{ teamId: '', workspaceName: null }]
  }, [installations, isMultiWorkspace])

  const canBind = workspaceOptions.length > 0

  return (
    <div className="flex flex-col gap-6">
      {!isConfigured && (
        <p className="border-2 border-foreground bg-muted px-4 py-3 text-sm">
          Slack is not configured on this deployment. Set{' '}
          <code className="font-mono">SLACK_CLIENT_ID</code>,{' '}
          <code className="font-mono">SLACK_CLIENT_SECRET</code>, and{' '}
          <code className="font-mono">SLACK_SIGNING_SECRET</code> (or the
          single-workspace token pair) and redeploy.
        </p>
      )}

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

function InstallationsBlock({
  installations,
  isMultiWorkspace,
  onChanged,
}: {
  installations: InstallationView[]
  isMultiWorkspace: boolean
  onChanged: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [pendingTeamId, setPendingTeamId] = useState<string | null>(null)

  if (!isMultiWorkspace) {
    return (
      <div className="border-2 border-foreground bg-muted px-4 py-3">
        <p className="font-bold text-xs uppercase tracking-[0.16em]">
          Single-workspace mode
        </p>
        <p className="mt-1 text-muted-foreground text-sm">
          The bot uses the workspace bot token from{' '}
          <code className="font-mono">SLACK_BOT_TOKEN</code>. Bindings are
          created with workspace id <code className="font-mono">""</code>.
        </p>
      </div>
    )
  }

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
        href="/api/channels/slack/install"
      >
        <Plus aria-hidden className="size-3.5" />
        {installations.length === 0 ? 'Install Slack app' : 'Add workspace'}
      </a>
    </div>
  )
}

function BindingsBlock({
  agentId,
  bindings,
  installations,
  isMultiWorkspace,
  onChanged,
}: {
  agentId: string
  bindings: SlackBindingView[]
  installations: InstallationView[]
  isMultiWorkspace: boolean
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
          route a channel, DM, or workspace fallback.
        </p>
      ) : (
        <ul className="flex flex-col divide-y-2 divide-foreground border-foreground border-y-2">
          {bindings.map((binding) => (
            <li
              className="flex items-center justify-between gap-3 py-3"
              key={binding.id}
            >
              <div className="flex min-w-0 items-center gap-3">
                <BindingIcon kind={binding.kind} />
                <div className="min-w-0">
                  <p className="font-bold text-sm">
                    {KIND_LABEL[binding.kind]}{' '}
                    <span className="font-mono font-normal text-muted-foreground">
                      {describeBindingTarget(binding)}
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
                className="inline-flex h-9 w-9 items-center justify-center border-2 border-foreground transition-colors hover:bg-destructive hover:text-background disabled:opacity-50"
                disabled={pending && pendingId === binding.id}
                onClick={() => remove(binding.id)}
                type="button"
              >
                <Trash2 aria-hidden className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {bindings.length > 0 &&
        installations.length === 0 &&
        isMultiWorkspace && (
          <p className="text-destructive text-xs">
            One or more bindings reference a workspace you no longer have
            installed — they will be ignored until you reinstall.
          </p>
        )}
    </div>
  )
}

function BindingIcon({ kind }: { kind: SlackBindingView['kind'] }) {
  if (kind === 'channel') {
    return <Hash aria-hidden className="size-4 shrink-0" />
  }
  if (kind === 'dm') {
    return <UserIcon aria-hidden className="size-4 shrink-0" />
  }
  return (
    <span
      aria-hidden
      className="inline-block size-2 shrink-0 rounded-full bg-foreground"
    />
  )
}

function AddBindingForm({
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

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
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

      <label className="flex flex-col gap-1">
        <span className="font-bold text-[10px] uppercase tracking-[0.2em]">
          Workspace
        </span>
        <select
          className="h-10 w-full border-2 border-foreground bg-background px-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          disabled={!isMultiWorkspace}
          onChange={(e) => setTeamId(e.target.value)}
          value={teamId}
        >
          {workspaces.map((ws) => (
            <option key={ws.teamId} value={ws.teamId}>
              {workspaceLabel(ws)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-bold text-[10px] uppercase tracking-[0.2em]">
          Routing kind
        </span>
        <select
          className="h-10 w-full border-2 border-foreground bg-background px-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          onChange={(e) => setKind(e.target.value as SlackBindingView['kind'])}
          value={kind}
        >
          <option value="channel">
            Channel — route a public/private channel
          </option>
          <option value="dm">Direct message — route DMs from one user</option>
          <option value="default">
            Workspace fallback — any unbound thread
          </option>
        </select>
      </label>

      {kind !== 'default' && (
        <label className="flex flex-col gap-1">
          <span className="font-bold text-[10px] uppercase tracking-[0.2em]">
            {externalKeyLabel}
          </span>
          <input
            className="h-10 w-full border-2 border-foreground bg-background px-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            onChange={(e) => setExternalKey(e.target.value)}
            placeholder={externalKeyPlaceholder}
            required
            type="text"
            value={externalKey}
          />
          <span className="text-muted-foreground text-xs">
            {kind === 'channel'
              ? 'Find a channel id from Slack → channel → ⓘ → "Copy channel ID".'
              : 'Find a user id from a Slack profile → ⋮ → "Copy member ID".'}
          </span>
        </label>
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
