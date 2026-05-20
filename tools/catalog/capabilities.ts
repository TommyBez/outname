import type { ToolCapability } from './types'

export type ConnectorBackedCapability = Extract<
  ToolCapability,
  { connectorId: string }
>

export function isConnectorBackedCapability(
  capability: ToolCapability
): capability is ConnectorBackedCapability {
  return (
    capability.kind === 'brokered_http' ||
    capability.kind === 'repo_workspace' ||
    capability.kind === 'sdk'
  )
}

export function connectorBackedCapabilities(
  capabilities: readonly ToolCapability[]
): ConnectorBackedCapability[] {
  return capabilities.filter(isConnectorBackedCapability)
}
