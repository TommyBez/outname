import type { ToolCapability } from './types'

export type ConnectorBackedCapability = Extract<
  ToolCapability,
  { connectorId: string }
>

export function isConnectorBackedCapability(
  capability: ToolCapability
): capability is ConnectorBackedCapability {
  return (
    'connectorId' in capability && typeof capability.connectorId === 'string'
  )
}

export function connectorBackedCapabilities(
  capabilities: readonly ToolCapability[]
): ConnectorBackedCapability[] {
  return capabilities.filter(isConnectorBackedCapability)
}
