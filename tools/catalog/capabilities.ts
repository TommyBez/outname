import type { ToolCapability } from './types'

export type ProviderBackedCapability = Extract<
  ToolCapability,
  { provider: string }
>

export function isProviderBackedCapability(
  capability: ToolCapability
): capability is ProviderBackedCapability {
  return (
    capability.kind === 'brokered_http' ||
    capability.kind === 'repo_workspace' ||
    capability.kind === 'sdk'
  )
}

export function providerBackedCapabilities(
  capabilities: readonly ToolCapability[]
): ProviderBackedCapability[] {
  return capabilities.filter(isProviderBackedCapability)
}
