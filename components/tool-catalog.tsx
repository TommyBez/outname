'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import type { ConnectionStatus } from '@/lib/db/schema'
import { attachToolAction, detachToolAction } from '@/lib/tool-actions'

export interface ToolConfigField {
  defaultValue?: string | number | boolean
  description?: string
  label: string
  name: string
  placeholder?: string
  required: boolean
  type: 'text' | 'number' | 'boolean'
}

export interface ToolCatalogEntry {
  /** Pre-described config fields, derived from the maintainer tool's Zod schema. */
  configFields: ToolConfigField[]
  description: string
  displayName: string
  /** Required providers (`google`, `resend`, ...) extracted from `requirements`. */
  providers: string[]
  toolId: string
}

export interface AttachedToolView {
  config: Record<string, unknown>
  toolId: string
}

export interface ProviderConnectionView {
  displayName: string
  provider: string
  status: ConnectionStatus | null
}

interface Props {
  agentId: string
  attached: AttachedToolView[]
  catalog: ToolCatalogEntry[]
  connections: ProviderConnectionView[]
}

function findAttached(attached: AttachedToolView[], toolId: string) {
  return attached.find((a) => a.toolId === toolId) ?? null
}

function findConnection(
  connections: ProviderConnectionView[],
  provider: string
) {
  return connections.find((c) => c.provider === provider) ?? null
}

export function ToolCatalog({
  agentId,
  catalog,
  attached,
  connections,
}: Props) {
  return (
    <ul className="flex flex-col divide-y-2 divide-foreground border-foreground border-y-2">
      {catalog.map((entry) => (
        <li className="py-6" key={entry.toolId}>
          <ToolRow
            agentId={agentId}
            attached={findAttached(attached, entry.toolId)}
            connections={connections}
            entry={entry}
          />
        </li>
      ))}
    </ul>
  )
}

function ToolRow({
  agentId,
  entry,
  attached,
  connections,
}: {
  agentId: string
  entry: ToolCatalogEntry
  attached: AttachedToolView | null
  connections: ProviderConnectionView[]
}) {
  const isAttached = attached !== null

  const providerStates = entry.providers.map((p) => {
    const c = findConnection(connections, p)
    return {
      provider: p,
      status: c?.status ?? null,
      displayName: c?.displayName ?? p,
    }
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="min-w-0">
          <p className="font-black font-mono text-sm uppercase tracking-[0.04em]">
            {entry.toolId}
          </p>
          <p className="mt-1 font-black font-serif text-xl uppercase tracking-[-0.04em]">
            {entry.displayName}
          </p>
          <p className="mt-1 text-muted-foreground text-sm">
            {entry.description}
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            {providerStates.length === 0 && (
              <span className="font-bold text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
                No connection required
              </span>
            )}
            {providerStates.map((p) => (
              <ProviderChip key={p.provider} provider={p} />
            ))}
          </div>
        </div>
      </div>
      <AttachmentForm
        agentId={agentId}
        attached={attached}
        entry={entry}
        isAttached={isAttached}
      />
    </div>
  )
}

function submitButtonLabel(pending: boolean, isAttached: boolean): string {
  if (pending) {
    return 'Saving...'
  }
  if (isAttached) {
    return 'Save changes'
  }
  return 'Attach'
}

function providerBadgeClass(status: ConnectionStatus | null): string {
  if (status === 'active') {
    return 'border-foreground bg-foreground text-background'
  }
  if (status === null) {
    return 'border-muted-foreground text-muted-foreground'
  }
  return 'border-destructive text-destructive'
}

function providerBadgeLabel(
  displayName: string,
  status: ConnectionStatus | null
): string {
  if (status === 'active') {
    return `${displayName} ✓`
  }
  if (status === null) {
    return `${displayName} — not connected`
  }
  return `${displayName} — ${status}`
}

function ProviderChip({
  provider,
}: {
  provider: {
    provider: string
    status: ConnectionStatus | null
    displayName: string
  }
}) {
  const cls = providerBadgeClass(provider.status)
  const label = providerBadgeLabel(provider.displayName, provider.status)
  return (
    <a
      className={`inline-flex h-7 items-center border-2 px-3 font-bold text-[10px] uppercase tracking-[0.16em] ${cls}`}
      href="/settings"
    >
      {label}
    </a>
  )
}

function defaultValuesFor(
  entry: ToolCatalogEntry,
  attached: AttachedToolView | null
) {
  const out: Record<string, string> = {}
  for (const f of entry.configFields) {
    const existing = attached?.config?.[f.name]
    if (existing !== undefined && existing !== null) {
      out[f.name] = String(existing)
    } else if (f.defaultValue === undefined) {
      out[f.name] = ''
    } else {
      out[f.name] = String(f.defaultValue)
    }
  }
  return out
}

function AttachmentForm({
  agentId,
  entry,
  attached,
  isAttached,
}: {
  agentId: string
  entry: ToolCatalogEntry
  attached: AttachedToolView | null
  isAttached: boolean
}) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const initial = useMemo(
    () => defaultValuesFor(entry, attached),
    [entry, attached]
  )
  const [values, setValues] = useState<Record<string, string>>(initial)
  const [open, setOpen] = useState(false)

  const hasFields = entry.configFields.length > 0

  function coerce(field: ToolConfigField, raw: string) {
    if (field.type === 'number') {
      return raw === '' ? undefined : Number(raw)
    }
    if (field.type === 'boolean') {
      return raw === 'true'
    }
    return raw
  }

  function handleAttach(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    const config: Record<string, unknown> = {}
    for (const f of entry.configFields) {
      const v = coerce(f, values[f.name] ?? '')
      if (v !== undefined && v !== '') {
        config[f.name] = v
      }
    }
    startTransition(async () => {
      const res = await attachToolAction(agentId, entry.toolId, config)
      if (!res.ok) {
        toast.error(res.error ?? 'Attach failed.')
        return
      }
      toast.success(isAttached ? 'Tool updated.' : 'Tool attached.')
      setOpen(false)
      router.refresh()
    })
  }

  function handleDetach() {
    startTransition(async () => {
      const res = await detachToolAction(agentId, entry.toolId)
      if (!res.ok) {
        toast.error(res.error ?? 'Detach failed.')
        return
      }
      toast.success('Tool detached.')
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {!(isAttached || hasFields) && (
          <button
            className="inline-flex h-10 items-center justify-center border-2 border-foreground bg-foreground px-4 font-bold text-background text-xs uppercase tracking-[0.16em] transition-colors hover:bg-background hover:text-foreground disabled:opacity-50"
            disabled={pending}
            onClick={() => handleAttach()}
            type="button"
          >
            {pending ? '...' : 'Attach'}
          </button>
        )}
        {!isAttached && hasFields && (
          <button
            className="inline-flex h-10 items-center justify-center border-2 border-foreground bg-foreground px-4 font-bold text-background text-xs uppercase tracking-[0.16em] transition-colors hover:bg-background hover:text-foreground"
            onClick={() => setOpen((v) => !v)}
            type="button"
          >
            {open ? 'Cancel' : 'Attach'}
          </button>
        )}
        {isAttached && hasFields && (
          <button
            className="inline-flex h-10 items-center justify-center border-2 border-foreground px-4 font-bold text-xs uppercase tracking-[0.16em] transition-colors hover:bg-foreground hover:text-background"
            onClick={() => setOpen((v) => !v)}
            type="button"
          >
            {open ? 'Cancel' : 'Edit config'}
          </button>
        )}
        {isAttached && (
          <button
            className="inline-flex h-10 items-center justify-center border-2 border-foreground px-4 font-bold text-xs uppercase tracking-[0.16em] transition-colors hover:bg-destructive hover:text-background disabled:opacity-50"
            disabled={pending}
            onClick={handleDetach}
            type="button"
          >
            {pending ? '...' : 'Detach'}
          </button>
        )}
        {isAttached && (
          <span
            className="inline-flex h-10 items-center border-2 border-foreground bg-foreground px-3 font-bold text-[10px] text-background uppercase tracking-[0.16em]"
            role="status"
          >
            Attached
          </span>
        )}
      </div>
      {open && hasFields && (
        <form
          className="flex w-full max-w-lg flex-col gap-3 border-2 border-foreground bg-muted p-4"
          onSubmit={handleAttach}
        >
          {entry.configFields.map((field) => {
            const inputId = `tool-${entry.toolId}-${field.name}`
            return (
              <div className="flex flex-col gap-1" key={field.name}>
                <label
                  className="font-bold text-[10px] uppercase tracking-[0.2em]"
                  htmlFor={inputId}
                >
                  {field.label}
                  {field.required && (
                    <span className="ml-1 text-destructive">*</span>
                  )}
                </label>
                {field.description && (
                  <span className="text-muted-foreground text-xs">
                    {field.description}
                  </span>
                )}
                {field.type === 'boolean' ? (
                  <select
                    className="h-10 w-full border-2 border-foreground bg-background px-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    id={inputId}
                    onChange={(e) =>
                      setValues((v) => ({
                        ...v,
                        [field.name]: e.target.value,
                      }))
                    }
                    value={values[field.name] ?? 'false'}
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : (
                  <input
                    className="h-10 w-full border-2 border-foreground bg-background px-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    id={inputId}
                    onChange={(e) =>
                      setValues((v) => ({
                        ...v,
                        [field.name]: e.target.value,
                      }))
                    }
                    placeholder={field.placeholder}
                    required={field.required}
                    type={field.type === 'number' ? 'number' : 'text'}
                    value={values[field.name] ?? ''}
                  />
                )}
              </div>
            )
          })}
          <button
            className="inline-flex h-10 items-center justify-center border-2 border-foreground bg-foreground px-4 font-bold text-background text-xs uppercase tracking-[0.16em] transition-colors hover:bg-background hover:text-foreground disabled:opacity-50"
            disabled={pending}
            type="submit"
          >
            {submitButtonLabel(pending, isAttached)}
          </button>
        </form>
      )}
    </div>
  )
}
