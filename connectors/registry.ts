import 'server-only'
import { resendConnector } from './resend'
import type { Connector } from './types'

/**
 * Central connector registry. Add a connector here and the runtime,
 * the HTTP layer, and the catalog UI pick it up automatically.
 */

const CONNECTORS: Connector[] = [resendConnector]

export function listConnectors(): readonly Connector[] {
  return CONNECTORS
}

export function getConnector(provider: string): Connector | undefined {
  return CONNECTORS.find((c) => c.provider === provider)
}
