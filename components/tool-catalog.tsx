'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { useToolSandboxBuildStream } from '@/hooks/use-tool-sandbox-build-stream'
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
  /** Required providers (`resend`, ...) extracted from `requirements`. */
  providers: string[]
  toolId: string
  /**
   * Phase 4: manifest id this tool requires a tool-sandbox snapshot
   * for. `null` means "no sandbox needed" (e.g. resend_send).
   */
  toolSandboxManifest: string | null
}

export interface AttachedToolView {
  config: Record<string, unknown>
  /**
   * Phase 4: id of the latest in-flight build for this tool's
   * manifest, if any. Set when `status === 'pending'`. The catalog
   * subscribes to its progress stream.
   */
  pendingBuildId: string | null
  /**
   * Phase 4: lifecycle of the attachment row. `pending` means the
   * tool needs a tool sandbox that's still being built; the catalog
   * shows live progress and disables the form until the build
   * finishes.
   */
  status: 'connected' | 'pending'
  toolId: string
  /**
   * Phase 4: sticky error from the last failed build, surfaced
   * alongside a Retry button.
   */
  toolSandboxError: string | null
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
  const isPending = attached?.status === 'pending'
  const isBuilding = Boolean(isPending && attached?.pendingBuildId)
  const isFailedPending = Boolean(
    isPending && !attached?.pendingBuildId && attached?.toolSandboxError
  )

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
            {providerStates.length === 0 &&
              entry.toolSandboxManifest === null && (
                <span className="font-bold text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
                  No connection required
                </span>
              )}
            {entry.toolSandboxManifest !== null && (
              <span className="inline-flex h-7 items-center border-2 border-foreground px-3 font-bold text-[10px] uppercase tracking-[0.16em]">
                Sandbox: {entry.toolSandboxManifest}
              </span>
            )}
            {providerStates.map((p) => (
              <ProviderChip key={p.provider} provider={p} />
            ))}
          </div>
        </div>
      </div>
      {isPending && attached?.pendingBuildId && (
        <PendingBuildStrip buildId={attached.pendingBuildId} />
      )}
      {attached?.toolSandboxError && (
        <p
          className="border-2 border-destructive bg-destructive/5 px-3 py-2 font-mono text-destructive text-xs"
          role="alert"
        >
          Last build failed: {attached.toolSandboxError}
        </p>
      )}
      <AttachmentForm
        agentId={agentId}
        attached={attached}
        entry={entry}
        isAttached={isAttached}
        isBuilding={isBuilding}
        isFailedPending={isFailedPending}
        isPending={isPending}
      />
    </div>
  )
}

function PendingBuildStrip({ buildId }: { buildId: string }) {
  const router = useRouter()
  const state = useToolSandboxBuildStream(buildId, () => {
    // Both `ready` and `failed` are terminal — refresh the page so
    // the server component re-reads the agent_tools row and the
    // catalog rerenders with the new status (and any sticky error).
    router.refresh()
  })

  let label = 'Preparing tool environment...'
  if (state.kind === 'progress') {
    label = state.message
  } else if (state.kind === 'connecting') {
    label = 'Connecting to build stream...'
  } else if (state.kind === 'ready') {
    label = 'Snapshot ready, finalizing...'
  } else if (state.kind === 'failed') {
    label = `Build failed: ${state.error}`
  }

  const isError = state.kind === 'failed'

  return (
    <div
      aria-live="polite"
      className={`flex items-center gap-3 border-2 px-3 py-2 ${
        isError
          ? 'border-destructive bg-destructive/5 text-destructive'
          : 'border-foreground bg-muted'
      }`}
      role="status"
    >
      {!isError && (
        <span
          aria-hidden="true"
          className="inline-block h-2 w-2 animate-pulse rounded-full bg-foreground"
        />
      )}
      <p className="font-mono text-xs leading-relaxed">{label}</p>
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
  isBuilding,
  isAttached,
  isFailedPending,
  isPending,
}: {
  agentId: string
  entry: ToolCatalogEntry
  attached: AttachedToolView | null
  isBuilding: boolean
  isAttached: boolean
  isFailedPending: boolean
  isPending: boolean
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
      if (res.pendingBuildId) {
        toast.success('Tool environment is being prepared...')
      } else {
        toast.success(isAttached ? 'Tool updated.' : 'Tool attached.')
      }
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
            disabled={pending || isBuilding}
            onClick={() => handleAttach()}
            type="button"
          >
            {pending ? '...' : 'Attach'}
          </button>
        )}
        {!isAttached && hasFields && (
          <button
            className="inline-flex h-10 items-center justify-center border-2 border-foreground bg-foreground px-4 font-bold text-background text-xs uppercase tracking-[0.16em] transition-colors hover:bg-background hover:text-foreground disabled:opacity-50"
            disabled={isBuilding}
            onClick={() => setOpen((v) => !v)}
            type="button"
          >
            {open ? 'Cancel' : 'Attach'}
          </button>
        )}
        {isAttached && hasFields && (
          <button
            className="inline-flex h-10 items-center justify-center border-2 border-foreground px-4 font-bold text-xs uppercase tracking-[0.16em] transition-colors hover:bg-foreground hover:text-background disabled:opacity-50"
            disabled={isBuilding}
            onClick={() => setOpen((v) => !v)}
            type="button"
          >
            {open ? 'Cancel' : 'Edit config'}
          </button>
        )}
        {isAttached && hasFields && isFailedPending && (
          <button
            className="inline-flex h-10 items-center justify-center border-2 border-foreground bg-foreground px-4 font-bold text-background text-xs uppercase tracking-[0.16em] transition-colors hover:bg-background hover:text-foreground disabled:opacity-50"
            disabled={pending}
            onClick={() => handleAttach()}
            type="button"
          >
            {pending ? '...' : 'Retry'}
          </button>
        )}
        {isAttached && !hasFields && isFailedPending && (
          <button
            className="inline-flex h-10 items-center justify-center border-2 border-foreground bg-foreground px-4 font-bold text-background text-xs uppercase tracking-[0.16em] transition-colors hover:bg-background hover:text-foreground disabled:opacity-50"
            disabled={pending}
            onClick={() => handleAttach()}
            type="button"
          >
            {pending ? '...' : 'Retry'}
          </button>
        )}
        {isAttached && (
          <button
            className="inline-flex h-10 items-center justify-center border-2 border-foreground px-4 font-bold text-xs uppercase tracking-[0.16em] transition-colors hover:bg-destructive hover:text-background disabled:opacity-50"
            disabled={pending || isBuilding}
            onClick={handleDetach}
            type="button"
          >
            {pending ? '...' : 'Detach'}
          </button>
        )}
        {isAttached && !isPending && (
          <span
            className="inline-flex h-10 items-center border-2 border-foreground bg-foreground px-3 font-bold text-[10px] text-background uppercase tracking-[0.16em]"
            role="status"
          >
            Attached
          </span>
        )}
        {isPending && (
          <span
            className={`inline-flex h-10 items-center border-2 px-3 font-bold text-[10px] uppercase tracking-[0.16em] ${
              isFailedPending
                ? 'border-destructive text-destructive'
                : 'border-foreground'
            }`}
            role="status"
          >
            {isFailedPending ? 'Build failed' : 'Preparing...'}
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
