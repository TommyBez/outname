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
import { xConnector, xOAuthConnector } from './x'

/**
 * Central connector registry. Add a connector here and the runtime,
 * the HTTP layer, and the catalog UI pick it up automatically.
 */

const CONNECTOR_ID_PATTERN = /^[a-z0-9_]+\.[a-z0-9_]+$/

const CONNECTORS: Connector[] = [
  resendConnector,
  calcomConnector,
  context7Connector,
  firecrawlConnector,
  githubConnector,
  parallelConnector,
  posthogConnector,
  xConnector,
  xOAuthConnector,
  typefullyConnector,
  supabaseConnector,
  v0Connector,
  vercelConnector,
]
const CONNECTOR_BY_ID = new Map<string, Connector>()

for (const connector of CONNECTORS) {
  if (!CONNECTOR_ID_PATTERN.test(connector.connectorId)) {
    throw new Error(`Invalid connectorId: ${connector.connectorId}`)
  }
  const expectedProviderGroup = connector.connectorId.split('.')[0]
  if (connector.providerGroup !== expectedProviderGroup) {
    throw new Error(
      `Connector ${connector.connectorId} providerGroup must be "${expectedProviderGroup}".`
    )
  }
  if (CONNECTOR_BY_ID.has(connector.connectorId)) {
    throw new Error(`Duplicate connectorId: ${connector.connectorId}`)
  }
  for (const host of connector.broker.allowedHosts) {
    if (host.includes('*') || host !== host.toLowerCase()) {
      throw new Error(
        `Connector ${connector.connectorId} must declare exact lowercase broker hosts. Invalid host: ${host}`
      )
    }
  }
  for (const header of connector.broker.injectedHeaderNames) {
    if (header !== header.toLowerCase()) {
      throw new Error(
        `Connector ${connector.connectorId} must declare lowercase injected header names. Invalid header: ${header}`
      )
    }
  }
  CONNECTOR_BY_ID.set(connector.connectorId, connector)
}

validateConnectorInfrastructureForEnv(CONNECTORS, process.env)

export function listConnectors(): readonly Connector[] {
  return CONNECTORS
}

export function getConnector(connectorId: string): Connector | undefined {
  return CONNECTOR_BY_ID.get(connectorId)
}

export function validateConnectorInfrastructureForEnv(
  connectors: readonly Connector[],
  env: Record<string, string | undefined>
): void {
  const hasUpstashRedis = Boolean(env.KV_REST_API_URL && env.KV_REST_API_TOKEN)
  if (
    env.NODE_ENV !== 'test' &&
    connectors.some((connector) => connector.authKind === 'oauth2') &&
    !hasUpstashRedis
  ) {
    throw new Error(
      'OAuth connectors require KV_REST_API_URL/KV_REST_API_TOKEN.'
    )
  }
}

export interface ConnectorGroup {
  connectors: readonly Connector[]
  providerGroup: string
}

export function listConnectorGroups(): readonly ConnectorGroup[] {
  const groups = new Map<string, Connector[]>()
  for (const connector of CONNECTORS) {
    const group = groups.get(connector.providerGroup) ?? []
    group.push(connector)
    groups.set(connector.providerGroup, group)
  }
  return Array.from(groups.entries()).map(([providerGroup, connectors]) => ({
    providerGroup,
    connectors,
  }))
}

export type ConnectorRuntimeConfigResult =
  | { ok: true }
  | { error: string; missingEnvVars: string[]; ok: false }

export function validateConnectorRuntimeConfig(
  connectorId: string
): ConnectorRuntimeConfigResult {
  const connector = getConnector(connectorId)
  if (!connector) {
    return {
      ok: false,
      error: `Unknown connector: ${connectorId}`,
      missingEnvVars: [],
    }
  }
  if (connector.authKind !== 'oauth2') {
    return { ok: true }
  }

  const envVars = [
    connector.oauth2.clientIdEnv,
    connector.oauth2.clientSecretEnv,
  ].filter((value): value is string => Boolean(value))
  const missingEnvVars = envVars.filter((name) => !process.env[name])
  if (missingEnvVars.length > 0) {
    return {
      ok: false,
      missingEnvVars,
      error: `OAuth connector ${connector.displayName} is missing environment variable${missingEnvVars.length === 1 ? '' : 's'}: ${missingEnvVars.join(', ')}`,
    }
  }
  return { ok: true }
}
