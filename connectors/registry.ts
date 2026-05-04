import 'server-only'
import { calcomConnector } from './calcom'
import { resendConnector } from './resend'
import type { Connector } from './types'

/**
 * Central connector registry. Add a connector here and the runtime,
 * the HTTP layer, and the catalog UI pick it up automatically.
 */

const CONNECTORS: Connector[] = [resendConnector, calcomConnector]
const CONNECTOR_BY_PROVIDER = new Map<string, Connector>()

for (const connector of CONNECTORS) {
  if (CONNECTOR_BY_PROVIDER.has(connector.provider)) {
    throw new Error(`Duplicate connector provider: ${connector.provider}`)
  }
  for (const host of connector.broker.allowedHosts) {
    if (host.includes('*') || host !== host.toLowerCase()) {
      throw new Error(
        `Connector ${connector.provider} must declare exact lowercase broker hosts. Invalid host: ${host}`
      )
    }
  }
  CONNECTOR_BY_PROVIDER.set(connector.provider, connector)
}

export function listConnectors(): readonly Connector[] {
  return CONNECTORS
}

export function getConnector(provider: string): Connector | undefined {
  return CONNECTOR_BY_PROVIDER.get(provider)
}
