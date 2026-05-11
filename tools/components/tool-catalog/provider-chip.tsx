import type { ProviderState } from './types'
import { providerBadgeClass, providerBadgeLabel } from './utils'

export function ProviderChip({ provider }: { provider: ProviderState }) {
  const cls = providerBadgeClass(provider.status)
  const label = providerBadgeLabel(provider.displayName, provider.status)
  return (
    <a
      className={`inline-flex h-7 items-center border-2 px-3 font-bold text-[10px] uppercase tracking-[0.16em] ${cls}`}
      href="/connections"
    >
      {label}
    </a>
  )
}
