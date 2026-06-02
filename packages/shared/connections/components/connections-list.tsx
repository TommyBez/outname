'use client'

import type { ConnectionStatus } from '@outname/db/schema'
import {
  disconnectConnectionAction,
  saveApiKeyConnectionAction,
} from '@outname/shared/connections/actions'
import type { ScopeDescriptor } from '@outname/shared/connections/types'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

interface ConnectorSummary {
  apiKeyFields?: Array<{
    name: string
    label: string
    type: 'text' | 'password'
    placeholder?: string
  }>
  authKind: 'api_key' | 'oauth2'
  connectorId: string
  description: string
  displayName: string
  providerGroup: string
  scopeCatalog?: readonly ScopeDescriptor[]
}

interface ConnectionView {
  connectedAt: string
  connectorId: string
  grantedScopes: string[]
  lastError: string | null
  metadata: Record<string, unknown>
  status: ConnectionStatus
}

interface Props {
  connections: ConnectionView[]
  connectors: ConnectorSummary[]
}

interface ConnectorRowData {
  connection: ConnectionView | null
  connector: ConnectorSummary
}

function findConnection(connections: ConnectionView[], connectorId: string) {
  return connections.find((c) => c.connectorId === connectorId) ?? null
}

function getConnectorRows({
  connections,
  connectors,
}: Props): ConnectorRowData[] {
  return connectors.map((connector) => ({
    connection: findConnection(connections, connector.connectorId),
    connector,
  }))
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
  const username =
    typeof metadata.username === 'string' ? metadata.username : null
  if (username) {
    return `@${username}`
  }
  return null
}

const STATUS_COPY: Record<ConnectionStatus, string> = {
  active: 'Connected',
  invalid: 'Invalid — replace key',
}

export function ConnectionsList({ connectors, connections }: Props) {
  const rows = getConnectorRows({ connectors, connections })
  const connectedRows = rows.filter((row) => row.connection)
  const availableRows = rows.filter((row) => !row.connection)

  return (
    <div className="flex flex-col gap-10">
      <ConnectorSection rows={connectedRows} title="Connected" />
      <ConnectorSection rows={availableRows} title="Available to connect" />
    </div>
  )
}

function ConnectorSection({
  rows,
  title,
}: {
  rows: ConnectorRowData[]
  title: string
}) {
  if (rows.length === 0) {
    return null
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-bold text-xs uppercase tracking-[0.18em]">{title}</h2>
      <ul className="flex flex-col divide-y-2 divide-foreground border-foreground border-y-2">
        {rows.map(({ connection, connector }) => (
          <li className="py-6" key={connector.connectorId}>
            <ConnectorRow connection={connection} connector={connector} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function ConnectorRow({
  connector,
  connection,
}: {
  connector: ConnectorSummary
  connection: ConnectionView | null
}) {
  const identity = connection ? describeIdentity(connection.metadata) : null

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
              {identity && (
                <span className="font-mono text-muted-foreground">
                  {identity}
                </span>
              )}
            </p>
          ) : (
            <p className="mt-3 font-bold text-muted-foreground text-xs uppercase tracking-[0.16em]">
              Not connected
            </p>
          )}
          {connection?.lastError && (
            <p className="wrap-break-word mt-2 text-destructive text-xs">
              {connection.lastError}
            </p>
          )}
        </div>
        <ConnectionControls connection={connection} connector={connector} />
      </div>
    </div>
  )
}

function statusDotClass(status: ConnectionStatus): string {
  if (status === 'active') {
    return 'bg-foreground'
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

function ConnectionControls({
  connector,
  connection,
}: {
  connector: ConnectorSummary
  connection: ConnectionView | null
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const { refresh } = useRouter()
  const [values, setValues] = useState<Record<string, string>>({})

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const res = await saveApiKeyConnectionAction(
        connector.connectorId,
        values
      )
      if (!res.ok) {
        toast.error(res.error ?? 'Save failed.')
        return
      }
      toast.success('Connected.')
      setOpen(false)
      setValues({})
      refresh()
    })
  }

  function handleDisconnect() {
    startTransition(async () => {
      const res = await disconnectConnectionAction(connector.connectorId)
      if (!res.ok) {
        toast.error(res.error ?? 'Disconnect failed.')
        return
      }
      toast.success('Disconnected.')
      refresh()
    })
  }

  return (
    <div className="flex shrink-0 flex-col items-stretch gap-2 md:items-end">
      <div className="flex items-center gap-2">
        {connector.authKind === 'api_key' ? (
          <button
            className="inline-flex h-10 items-center justify-center border-2 border-foreground px-4 font-bold text-xs uppercase tracking-[0.16em] transition-colors hover:bg-foreground hover:text-background"
            onClick={() => setOpen((v) => !v)}
            type="button"
          >
            {connection ? 'Replace key' : 'Connect'}
          </button>
        ) : (
          <a
            className="inline-flex h-10 items-center justify-center border-2 border-foreground px-4 font-bold text-xs uppercase tracking-[0.16em] transition-colors hover:bg-foreground hover:text-background"
            href={`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/connections/oauth/${encodeURIComponent(connector.connectorId)}/start?returnTo=/connections`}
          >
            {connection
              ? `Reconnect ${connector.displayName}`
              : `Connect ${connector.displayName}`}
          </a>
        )}
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
      {connection && connector.authKind === 'oauth2' && (
        <ScopesSummary
          connectorId={connector.connectorId}
          displayName={connector.displayName}
          grantedScopes={connection.grantedScopes}
          scopeCatalog={connector.scopeCatalog ?? []}
        />
      )}
      {open && connector.authKind === 'api_key' && (
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
                aria-label={field.label}
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

function ScopesSummary({
  connectorId,
  displayName,
  grantedScopes,
  scopeCatalog,
}: {
  connectorId: string
  displayName: string
  grantedScopes: string[]
  scopeCatalog: readonly ScopeDescriptor[]
}) {
  const granted = new Set(grantedScopes)
  const labelByScope = new Map(
    scopeCatalog.map((item) => [item.scope, item.label])
  )
  const grantedLabels = grantedScopes.map(
    (scope) => labelByScope.get(scope) ?? scope
  )
  const missing = scopeCatalog.filter((item) => !granted.has(item.scope))
  const reconnectHref = `/api/connections/oauth/${encodeURIComponent(connectorId)}/start?returnTo=/connections`
  if (missing.length > 0) {
    return (
      <div
        className="max-w-sm border-2 border-destructive bg-destructive/5 p-3 text-xs"
        role="alert"
      >
        <p className="font-bold text-destructive uppercase tracking-[0.16em]">
          Missing OAuth scopes
        </p>
        <p className="mt-1 text-muted-foreground">
          Missing: {missing.map((item) => item.label).join(', ')}
        </p>
        <a
          className="mt-3 inline-flex h-8 items-center border-2 border-destructive px-3 font-bold text-[10px] text-destructive uppercase tracking-[0.16em] transition-colors hover:bg-destructive hover:text-background"
          href={reconnectHref}
        >
          Reconnect {displayName}
        </a>
      </div>
    )
  }
  return (
    <p className="max-w-sm text-muted-foreground text-xs">
      Scopes: {grantedLabels.length > 0 ? grantedLabels.join(', ') : 'none'}
    </p>
  )
}
