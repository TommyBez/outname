import 'server-only'
import { calcomConnector } from './calcom'
import { parallelConnector } from './parallel'
import { resendConnector } from './resend'
import { typefullyConnector } from './typefully'
import type { Connector } from './types'
import { vercelConnector } from './vercel'
import { xConnector } from './x'

/**
 * Central connector registry. Add a connector here and the runtime,
 * the HTTP layer, and the catalog UI pick it up automatically.
 */

const CONNECTORS: Connector[] = [
  resendConnector,
  calcomConnector,
  parallelConnector,
  xConnector,
  typefullyConnector,
  vercelConnector,
]
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
  for (const header of connector.broker.injectedHeaderNames) {
    if (header !== header.toLowerCase()) {
      throw new Error(
        `Connector ${connector.provider} must declare lowercase injected header names. Invalid header: ${header}`
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
