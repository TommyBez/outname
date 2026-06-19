import type { ConnectionStatus } from '@outname/db/schema'
import type {
  AttachedToolView,
  ConnectorConnectionView,
  ToolCatalogEntry,
} from './types'

export function findAttached(
  attached: AttachedToolView[],
  toolId: string
): AttachedToolView | null {
  return attached.find((item) => item.toolId === toolId) ?? null
}

export function findConnection(
  connections: ConnectorConnectionView[],
  connectorId: string
): ConnectorConnectionView | null {
  return (
    connections.find((connection) => connection.connectorId === connectorId) ??
    null
  )
}

export function defaultValuesFor(
  entry: ToolCatalogEntry,
  attached: AttachedToolView | null
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const field of entry.configFields) {
    const existing = attached?.config?.[field.name]
    if (existing !== undefined && existing !== null) {
      out[field.name] = String(existing)
    } else if (field.defaultValue === undefined) {
      out[field.name] = ''
    } else {
      out[field.name] = String(field.defaultValue)
    }
  }
  return out
}

export function submitButtonLabel(
  pending: boolean,
  isAttached: boolean
): string {
  if (pending) {
    return 'Saving...'
  }
  if (isAttached) {
    return 'Save changes'
  }
  return 'Attach'
}

export function connectorBadgeClass(status: ConnectionStatus | null): string {
  if (status === 'active') {
    return 'border-border bg-foreground text-background'
  }
  if (status === null) {
    return 'border-muted-foreground text-muted-foreground'
  }
  return 'border-destructive text-destructive'
}

export function connectorBadgeLabel(
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
