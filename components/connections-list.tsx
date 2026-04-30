'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  disconnectConnectionAction,
  saveApiKeyConnectionAction,
} from '@/lib/connection-actions'
import type { ConnectionStatus } from '@/lib/db/schema'

interface ConnectorSummary {
  apiKeyFields?: Array<{
    name: string
    label: string
    type: 'text' | 'password'
    placeholder?: string
  }>
  description: string
  displayName: string
  kind: 'oauth' | 'api_key'
  provider: string
}

interface ConnectionView {
  connectedAt: string
  lastError: string | null
  metadata: Record<string, unknown>
  provider: string
  status: ConnectionStatus
}

interface Props {
  connections: ConnectionView[]
  connectors: ConnectorSummary[]
}

function findConnection(connections: ConnectionView[], provider: string) {
  return connections.find((c) => c.provider === provider) ?? null
}

function describeIdentity(metadata: Record<string, unknown>): string | null {
  const email = typeof metadata.email === 'string' ? metadata.email : null
  if (email) {
    return email
  }
  const accountId =
    typeof metadata.accountId === 'string' ? metadata.accountId : null
  if (accountId) {
    return accountId
  }
  return null
}

const STATUS_COPY: Record<ConnectionStatus, string> = {
  active: 'Connected',
  expired: 'Expired — reconnect required',
  revoked: 'Revoked — reconnect required',
}

export function ConnectionsList({ connectors, connections }: Props) {
  return (
    <ul className="flex flex-col divide-y-2 divide-foreground border-foreground border-y-2">
      {connectors.map((c) => {
        const conn = findConnection(connections, c.provider)
        return (
          <li className="py-6" key={c.provider}>
            <ConnectorRow connection={conn} connector={c} />
          </li>
        )
      })}
    </ul>
  )
}

function ConnectorRow({
  connector,
  connection,
}: {
  connector: ConnectorSummary
  connection: ConnectionView | null
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="min-w-0">
          <p className="font-black font-serif text-xl uppercase tracking-[-0.04em]">
            {connector.displayName}
          </p>
          <p className="mt-1 text-muted-foreground text-sm">
            {connector.description}
          </p>
          {connection ? (
            <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
              <StatusDot status={connection.status} />
              <span className="font-bold uppercase tracking-[0.16em]">
                {STATUS_COPY[connection.status]}
              </span>
              {describeIdentity(connection.metadata) && (
                <span className="font-mono text-muted-foreground">
                  {describeIdentity(connection.metadata)}
                </span>
              )}
            </p>
          ) : (
            <p className="mt-3 font-bold text-muted-foreground text-xs uppercase tracking-[0.16em]">
              Not connected
            </p>
          )}
          {connection?.lastError && (
            <p className="mt-2 break-words text-destructive text-xs">
              {connection.lastError}
            </p>
          )}
        </div>
        <ConnectorAction connection={connection} connector={connector} />
      </div>
    </div>
  )
}

function statusDotClass(status: ConnectionStatus): string {
  if (status === 'active') {
    return 'bg-foreground'
  }
  if (status === 'expired') {
    return 'bg-accent'
  }
  return 'bg-destructive'
}

function StatusDot({ status }: { status: ConnectionStatus }) {
  return (
    <span
      aria-hidden
      className={`inline-block size-2 ${statusDotClass(status)}`}
    />
  )
}

function ConnectorAction({
  connector,
  connection,
}: {
  connector: ConnectorSummary
  connection: ConnectionView | null
}) {
  if (connector.kind === 'oauth') {
    return <OAuthButtons connection={connection} connector={connector} />
  }
  return <ApiKeyControls connection={connection} connector={connector} />
}

function OAuthButtons({
  connector,
  connection,
}: {
  connector: ConnectorSummary
  connection: ConnectionView | null
}) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleDisconnect() {
    startTransition(async () => {
      const res = await disconnectConnectionAction(connector.provider)
      if (!res.ok) {
        toast.error(res.error ?? 'Disconnect failed.')
        return
      }
      toast.success('Disconnected.')
      router.refresh()
    })
  }

  const connectHref = `/api/connections/${connector.provider}/connect?returnTo=/settings`

  return (
    <div className="flex shrink-0 items-center gap-2">
      <a
        className="inline-flex h-10 items-center justify-center border-2 border-foreground px-4 font-bold text-xs uppercase tracking-[0.16em] transition-colors hover:bg-foreground hover:text-background"
        href={connectHref}
      >
        {connection ? 'Reconnect' : 'Connect'}
      </a>
      {connection && (
        <button
          className="inline-flex h-10 items-center justify-center border-2 border-foreground px-4 font-bold text-xs uppercase tracking-[0.16em] transition-colors hover:bg-destructive hover:text-background disabled:opacity-50"
          disabled={pending}
          onClick={handleDisconnect}
          type="button"
        >
          {pending ? '...' : 'Disconnect'}
        </button>
      )}
    </div>
  )
}

function ApiKeyControls({
  connector,
  connection,
}: {
  connector: ConnectorSummary
  connection: ConnectionView | null
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const [values, setValues] = useState<Record<string, string>>({})

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const res = await saveApiKeyConnectionAction(connector.provider, values)
      if (!res.ok) {
        toast.error(res.error ?? 'Save failed.')
        return
      }
      toast.success('Connected.')
      setOpen(false)
      setValues({})
      router.refresh()
    })
  }

  function handleDisconnect() {
    startTransition(async () => {
      const res = await disconnectConnectionAction(connector.provider)
      if (!res.ok) {
        toast.error(res.error ?? 'Disconnect failed.')
        return
      }
      toast.success('Disconnected.')
      router.refresh()
    })
  }

  return (
    <div className="flex shrink-0 flex-col items-stretch gap-2 md:items-end">
      <div className="flex items-center gap-2">
        <button
          className="inline-flex h-10 items-center justify-center border-2 border-foreground px-4 font-bold text-xs uppercase tracking-[0.16em] transition-colors hover:bg-foreground hover:text-background"
          onClick={() => setOpen((v) => !v)}
          type="button"
        >
          {connection ? 'Replace key' : 'Connect'}
        </button>
        {connection && (
          <button
            className="inline-flex h-10 items-center justify-center border-2 border-foreground px-4 font-bold text-xs uppercase tracking-[0.16em] transition-colors hover:bg-destructive hover:text-background disabled:opacity-50"
            disabled={pending}
            onClick={handleDisconnect}
            type="button"
          >
            {pending ? '...' : 'Disconnect'}
          </button>
        )}
      </div>
      {open && (
        <form
          className="flex w-full max-w-sm flex-col gap-3 border-2 border-foreground bg-muted p-4"
          onSubmit={handleSubmit}
        >
          {(connector.apiKeyFields ?? []).map((field) => (
            <label className="flex flex-col gap-1" key={field.name}>
              <span className="font-bold text-[10px] uppercase tracking-[0.2em]">
                {field.label}
              </span>
              <input
                className="h-10 w-full border-2 border-foreground bg-background px-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                onChange={(e) =>
                  setValues((v) => ({ ...v, [field.name]: e.target.value }))
                }
                placeholder={field.placeholder}
                required
                type={field.type}
                value={values[field.name] ?? ''}
              />
            </label>
          ))}
          <button
            className="inline-flex h-10 items-center justify-center border-2 border-foreground bg-foreground px-4 font-bold text-background text-xs uppercase tracking-[0.16em] transition-colors hover:bg-background hover:text-foreground disabled:opacity-50"
            disabled={pending}
            type="submit"
          >
            {pending ? 'Saving...' : 'Save'}
          </button>
        </form>
      )}
    </div>
  )
}
