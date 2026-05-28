import Link from 'next/link'
import type { ConnectorState } from './types'
import { connectorBadgeClass, connectorBadgeLabel } from './utils'

export function ConnectorChip({ connector }: { connector: ConnectorState }) {
  const cls = connectorBadgeClass(connector.status)
  const label = connectorBadgeLabel(connector.displayName, connector.status)
  return (
    <Link
      className={`inline-flex h-7 items-center border-2 px-3 font-bold text-[10px] uppercase tracking-[0.16em] ${cls}`}
      href="/connections"
    >
      {label}
    </Link>
  )
}
