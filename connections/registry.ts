import 'server-only'
import { calcomConnector } from './calcom'
import { context7Connector } from './context7'
import { firecrawlConnector } from './firecrawl'
import { githubConnector } from './github'
import { parallelConnector } from './parallel'
import { posthogConnector } from './posthog'
import { resendConnector } from './resend'
import { supabaseConnector } from './supabase'
import { typefullyConnector } from './typefully'
import type { Connector } from './types'
import { v0Connector } from './v0'
import { vercelConnector } from './vercel'
import { xConnector } from './x'

/**
 * Central connector registry. Add a connector here and the runtime,
 * the HTTP layer, and the catalog UI pick it up automatically.
 */

const CONNECTORS: Connector[] = [
  resendConnector,
  calcomConnector,
  context7Connector,
  firecrawlConnector,
  githubConnector,
  parallelConnector,
  posthogConnector,
  xConnector,
  typefullyConnector,
  supabaseConnector,
  v0Connector,
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
