'use client'

import { Hash, Plus, Trash2, User as UserIcon, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { FormEvent } from 'react'
import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  deleteDiscordBindingAction,
  upsertDiscordBindingAction,
} from '@/channels/discord/server/actions'
import type {
  DiscordBindingView,
  DiscordGuildInstallationView,
  DiscordUserLinkView,
} from '@/channels/discord/server/bindings-query'
import { DiscordNotConfiguredNotice } from './discord-not-configured-notice'

type NewBindingKind = 'channel' | 'dm'

const KIND_LABEL: Record<NewBindingKind, string> = {
  channel: 'Channel',
  dm: 'Direct message',
}

export function DiscordBindingsPanel({
  agentId,
  bindings,
  guilds,
  isConfigured,
  userLinks,
}: {
  agentId: string
  bindings: DiscordBindingView[]
  guilds: DiscordGuildInstallationView[]
  isConfigured: boolean
  userLinks: DiscordUserLinkView[]
}) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const canBind = guilds.length > 0 || userLinks.length > 0

  return (
    <div className="flex flex-col gap-6">
      {!isConfigured && <DiscordNotConfiguredNotice />}

      {isConfigured && (
        <DiscordScopeSummary
          guilds={guilds}
          returnTo={`/agents/${agentId}/configure#integrations`}
          userLinks={userLinks}
        />
      )}

      <DiscordBindingsBlock
        agentId={agentId}
        bindings={bindings}
        onChanged={() => router.refresh()}
      />

      {isConfigured && (
        <div>
          {showForm ? (
            <AddDiscordBindingForm
              agentId={agentId}
              guilds={guilds}
              onCancel={() => setShowForm(false)}
              onSaved={() => {
                setShowForm(false)
                router.refresh()
              }}
              userLinks={userLinks}
            />
          ) : (
            <button
              className="inline-flex h-10 items-center gap-2 border-2 border-foreground px-4 font-bold text-xs uppercase tracking-[0.16em] transition-colors hover:bg-foreground hover:text-background disabled:opacity-50"
              disabled={!canBind}
              onClick={() => setShowForm(true)}
              title={
                canBind
                  ? undefined
                  : 'Install Discord in a server to add a binding.'
              }
              type="button"
            >
              <Plus aria-hidden className="size-3.5" />
              Add Discord binding
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function DiscordScopeSummary({
  guilds,
  returnTo,
  userLinks,
}: {
  guilds: DiscordGuildInstallationView[]
  returnTo: string
  userLinks: DiscordUserLinkView[]
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="font-bold text-xs uppercase tracking-[0.16em]">
        Available Discord scopes
      </p>
      <p className="text-muted-foreground text-sm">
        {guilds.length} server{guilds.length === 1 ? '' : 's'} installed,{' '}
        {userLinks.length} user link{userLinks.length === 1 ? '' : 's'} active.
      </p>
      <a
        className="inline-flex h-10 w-fit items-center gap-2 border-2 border-foreground bg-foreground px-4 font-bold text-background text-xs uppercase tracking-[0.16em] transition-colors hover:bg-background hover:text-foreground"
        href={discordInstallHref(returnTo)}
      >
        <Plus aria-hidden className="size-3.5" />
        Add Discord server
      </a>
    </div>
  )
}

function DiscordBindingsBlock({
  agentId,
  bindings,
  onChanged,
}: {
  agentId: string
  bindings: DiscordBindingView[]
  onChanged: () => void
}) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function remove(bindingId: string) {
    setPendingId(bindingId)
    startTransition(async () => {
      const result = await deleteDiscordBindingAction({ agentId, bindingId })
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
        Discord routing bindings
      </p>
      {bindings.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No Discord messages route to this agent yet. Add a channel or DM
          binding below.
        </p>
      ) : (
        <ul className="flex flex-col divide-y-2 divide-foreground border-foreground border-y-2">
          {bindings.map((binding) => (
            <DiscordBindingRow
              binding={binding}
              disabled={pending && pendingId === binding.id}
              key={binding.id}
              onRemove={() => remove(binding.id)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function DiscordBindingRow({
  binding,
  disabled,
  onRemove,
}: {
  binding: DiscordBindingView
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
            {binding.scopeLabel}
            {!binding.installed && (
              <span className="ml-2 inline-flex items-center gap-1 font-bold text-destructive uppercase tracking-[0.12em]">
                Scope not linked
              </span>
            )}
          </p>
        </div>
      </div>
      <button
        aria-label="Remove Discord binding"
        className="inline-flex h-9 w-9 items-center justify-center border-2 border-foreground transition-colors hover:bg-destructive hover:text-background disabled:opacity-50"
        disabled={disabled}
        onClick={onRemove}
        type="button"
      >
        <Trash2 aria-hidden className="size-3.5" />
      </button>
    </li>
  )
}

function AddDiscordBindingForm({
  agentId,
  guilds,
  onCancel,
  onSaved,
  userLinks,
}: {
  agentId: string
  guilds: DiscordGuildInstallationView[]
  onCancel: () => void
  onSaved: () => void
  userLinks: DiscordUserLinkView[]
}) {
  const defaultKind: NewBindingKind = guilds.length > 0 ? 'channel' : 'dm'
  const [pending, startTransition] = useTransition()
  const [kind, setKind] = useState<NewBindingKind>(defaultKind)
  const channelScopes = useMemo(() => guilds, [guilds])
  const dmScopes = useMemo(() => userLinks, [userLinks])
  const defaultScope =
    kind === 'channel'
      ? (channelScopes[0]?.externalScopeId ?? '')
      : (dmScopes[0]?.externalScopeId ?? '')
  const [externalScopeId, setExternalScopeId] = useState(defaultScope)
  const [externalKey, setExternalKey] = useState(
    kind === 'dm' ? (dmScopes[0]?.discordUserId ?? '') : ''
  )

  function updateKind(nextKind: NewBindingKind) {
    setKind(nextKind)
    if (nextKind === 'channel') {
      setExternalScopeId(channelScopes[0]?.externalScopeId ?? '')
      setExternalKey('')
      return
    }
    setExternalScopeId(dmScopes[0]?.externalScopeId ?? '')
    setExternalKey(dmScopes[0]?.discordUserId ?? '')
  }

  function updateScope(scopeId: string) {
    setExternalScopeId(scopeId)
    if (kind === 'dm') {
      setExternalKey(scopeId.startsWith('user:') ? scopeId.slice(5) : '')
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const result = await upsertDiscordBindingAction({
        agentId,
        externalKey: externalKey.trim(),
        externalScopeId,
        kind,
      })
      if (!result.ok) {
        toast.error(result.error ?? 'Could not save binding.')
        return
      }
      toast.success('Binding saved.')
      onSaved()
    })
  }

  const hasOptions =
    kind === 'channel' ? channelScopes.length > 0 : dmScopes.length > 0
  const externalKeyLabel =
    kind === 'channel' ? 'Discord channel id' : 'Discord user id'
  const externalKeyPlaceholder =
    kind === 'channel' ? '123456789012345678' : '123456789012345678'

  return (
    <form
      className="flex flex-col gap-4 border-2 border-foreground bg-muted p-4"
      onSubmit={handleSubmit}
    >
      <div className="flex items-center justify-between">
        <p className="font-bold text-xs uppercase tracking-[0.16em]">
          New Discord binding
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
          Routing kind
        </span>
        <select
          className="h-10 w-full border-2 border-foreground bg-background px-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          onChange={(event) => updateKind(event.target.value as NewBindingKind)}
          value={kind}
        >
          <option disabled={channelScopes.length === 0} value="channel">
            Channel - route a Discord channel or thread
          </option>
          <option disabled={dmScopes.length === 0} value="dm">
            Direct message - route DMs from a linked user
          </option>
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-bold text-[10px] uppercase tracking-[0.2em]">
          Scope
        </span>
        <select
          className="h-10 w-full border-2 border-foreground bg-background px-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          onChange={(event) => updateScope(event.target.value)}
          value={externalScopeId}
        >
          {kind === 'channel'
            ? channelScopes.map((guild) => (
                <option
                  key={guild.externalScopeId}
                  value={guild.externalScopeId}
                >
                  {guild.guildName
                    ? `${guild.guildName} (${guild.externalScopeId})`
                    : guild.externalScopeId}
                </option>
              ))
            : dmScopes.map((link) => (
                <option key={link.externalScopeId} value={link.externalScopeId}>
                  {link.discordUserName
                    ? `${link.discordUserName} (${link.externalScopeId})`
                    : link.externalScopeId}
                </option>
              ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-bold text-[10px] uppercase tracking-[0.2em]">
          {externalKeyLabel}
        </span>
        <input
          className="h-10 w-full border-2 border-foreground bg-background px-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          onChange={(event) => setExternalKey(event.target.value)}
          placeholder={externalKeyPlaceholder}
          readOnly={kind === 'dm'}
          required
          type="text"
          value={externalKey}
        />
        <span className="text-muted-foreground text-xs">
          {kind === 'channel'
            ? 'Use the Discord channel id that should route top-level mentions and /agent.'
            : 'DM routing uses the Discord user id linked during installation.'}
        </span>
      </label>

      <div className="flex items-center gap-2">
        <button
          className="inline-flex h-10 items-center justify-center border-2 border-foreground bg-foreground px-4 font-bold text-background text-xs uppercase tracking-[0.16em] transition-colors hover:bg-background hover:text-foreground disabled:opacity-50"
          disabled={pending || !hasOptions}
          type="submit"
        >
          {pending ? 'Saving...' : 'Save binding'}
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

function BindingIcon({ kind }: { kind: NewBindingKind }) {
  if (kind === 'channel') {
    return <Hash aria-hidden className="size-4 shrink-0" />
  }
  return <UserIcon aria-hidden className="size-4 shrink-0" />
}

function discordInstallHref(returnTo: string): string {
  const params = new URLSearchParams({ returnTo })
  return `/api/channels/discord/install?${params.toString()}`
}
