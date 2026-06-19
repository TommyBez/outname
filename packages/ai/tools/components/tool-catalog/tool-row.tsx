import Link from 'next/link'
import { AttachmentForm } from './attachment-form'
import { ConnectorChip } from './connector-chip'
import { PendingBuildStrip } from './pending-build-strip'
import type {
  AttachedToolView,
  ConnectorConnectionView,
  ToolCatalogEntry,
} from './types'
import { findConnection } from './utils'

export function ToolRow({
  agentId,
  entry,
  attached,
  connections,
}: {
  agentId: string
  entry: ToolCatalogEntry
  attached: AttachedToolView | null
  connections: ConnectorConnectionView[]
}) {
  const isPending = attached?.status === 'pending'
  const connectorStates = entry.connectors.map((connectorId) => {
    const connection = findConnection(connections, connectorId)
    return {
      connectorId,
      status: connection?.status ?? null,
      displayName: connection?.displayName ?? connectorId,
    }
  })
  const missingConnectors = connectorStates.filter(
    (connector) => connector.status !== 'active'
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="min-w-0">
          <p className="font-mono font-semibold text-sm">{entry.toolId}</p>
          <p className="mt-1 font-semibold text-xl tracking-[-0.04em]">
            {entry.displayName}
          </p>
          <p className="mt-1 text-muted-foreground text-sm">
            {entry.displayDescription}
          </p>
          {entry.exposedTools.length > 1 && (
            <div className="mt-2 flex flex-col gap-1">
              <p className="font-bold text-[10px] text-muted-foreground">
                Exposes {entry.exposedTools.length} child tools
              </p>
              <p className="font-mono text-muted-foreground text-xs">
                {entry.exposedTools
                  .slice(0, 4)
                  .map((child) => child.toolId)
                  .join(', ')}
                {entry.exposedTools.length > 4 ? ', ...' : ''}
              </p>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-3">
            {connectorStates.length === 0 &&
              entry.toolSandboxManifest === null && (
                <span className="font-bold text-[10px] text-muted-foreground">
                  No connection required
                </span>
              )}
            {entry.toolSandboxManifest !== null && (
              <span className="inline-flex h-7 items-center border border-border px-3 font-bold text-[10px]">
                Sandbox: {entry.toolSandboxManifest}
              </span>
            )}
            {connectorStates.map((connector) => (
              <ConnectorChip
                connector={connector}
                key={connector.connectorId}
              />
            ))}
          </div>
        </div>
      </div>
      {!attached && missingConnectors.length > 0 && (
        <p className="border border-border bg-muted px-3 py-2 text-muted-foreground text-xs">
          This tool needs{' '}
          {missingConnectors
            .map((connector) => connector.displayName)
            .join(', ')}{' '}
          before it can run.{' '}
          <Link
            className="font-bold text-foreground underline underline-offset-2 hover:text-brand"
            href="/connections"
          >
            Set it up in Connections →
          </Link>
        </p>
      )}
      {isPending && attached?.pendingBuildId && (
        <PendingBuildStrip buildId={attached.pendingBuildId} />
      )}
      {attached?.toolSandboxError && (
        <p
          className="border border-destructive bg-destructive/5 px-3 py-2 font-mono text-destructive text-xs"
          role="alert"
        >
          Last build failed: {attached.toolSandboxError}
        </p>
      )}
      <AttachmentForm agentId={agentId} attached={attached} entry={entry} />
    </div>
  )
}
