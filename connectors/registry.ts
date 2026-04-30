import 'server-only'
import { googleConnector } from './google'
import { resendConnector } from './resend'
import type { Connector } from './types'

/**
 * Central connector registry. Add a connector here and the runtime,
 * the HTTP layer, and the catalog UI pick it up automatically.
 *
 * Provider-sharing convention: a single `google` connection backs every
 * Google-API tool (Gmail, Calendar, Drive, …) — tools all declare
 * `{ provider: "google" }` in their `requirements` and the runtime
 * unions their scope sets at connect time. This is a tool-author
 * convention, not a connector contract: a future provider that doesn't
 * compose this way (e.g. Slack workspace per attachment) is free to
 * declare a different provider id per tool.
 */

const CONNECTORS: Connector[] = [googleConnector, resendConnector]

export function listConnectors(): readonly Connector[] {
  return CONNECTORS
}

export function getConnector(provider: string): Connector | undefined {
  return CONNECTORS.find((c) => c.provider === provider)
}

export function getOAuthConnectorOrThrow(
  provider: string
): Extract<Connector, { kind: 'oauth' }> {
  const connector = getConnector(provider)
  if (!connector) {
    throw new Error(`Unknown connector: ${provider}`)
  }
  if (connector.kind !== 'oauth') {
    throw new Error(`Connector ${provider} is not an OAuth connector`)
  }
  return connector
}

export function getApiKeyConnectorOrThrow(
  provider: string
): Extract<Connector, { kind: 'api_key' }> {
  const connector = getConnector(provider)
  if (!connector) {
    throw new Error(`Unknown connector: ${provider}`)
  }
  if (connector.kind !== 'api_key') {
    throw new Error(`Connector ${provider} is not an api_key connector`)
  }
  return connector
}
