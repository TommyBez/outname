import 'server-only'

import { db } from '@/shared/db'
import { userConnections } from '@/shared/db/schema'
import type { Reconnect } from '@/tools/catalog/types'
import { getConnector } from '../registry'
import { connectionFilter } from './connection-query'
import { normalizeScopes } from './scopes'
import type { ConnectorRequirement } from './types'

export interface ResolveConnectionAvailabilityResult {
  readyConnectors: Set<string>
  reconnects: Reconnect[]
}

interface ConnectorBucket {
  requiredScopes: Set<string>
  toolIds: Set<string>
}

export async function resolveConnectionAvailability(args: {
  userId: string
  requirements: ConnectorRequirement[]
}): Promise<ResolveConnectionAvailabilityResult> {
  const readyConnectors = new Set<string>()
  const reconnects: Reconnect[] = []
  const byConnector = bucketRequirementsByConnector(args.requirements)

  await Promise.all(
    Array.from(byConnector.entries()).map(([connectorId, bucket]) =>
      resolveOneConnector({
        userId: args.userId,
        connectorId,
        bucket,
        readyConnectors,
        reconnects,
      })
    )
  )

  return { readyConnectors, reconnects }
}

function bucketRequirementsByConnector(
  requirements: ConnectorRequirement[]
): Map<string, ConnectorBucket> {
  const byConnector = new Map<string, ConnectorBucket>()
  for (const req of requirements) {
    let bucket = byConnector.get(req.connectorId)
    if (!bucket) {
      bucket = { requiredScopes: new Set(), toolIds: new Set() }
      byConnector.set(req.connectorId, bucket)
    }
    bucket.toolIds.add(req.toolId)
    for (const scope of req.requiredScopes ?? []) {
      bucket.requiredScopes.add(scope)
    }
  }
  return byConnector
}

async function resolveOneConnector(args: {
  userId: string
  connectorId: string
  bucket: ConnectorBucket
  readyConnectors: Set<string>
  reconnects: Reconnect[]
}): Promise<void> {
  const { userId, connectorId, bucket, readyConnectors, reconnects } = args
  const connector = getConnector(connectorId)
  if (!connector) {
    fanOutReconnect(reconnects, connectorId, bucket.toolIds)
    return
  }

  const [connection] = await db
    .select({
      status: userConnections.status,
      grantedScopes: userConnections.grantedScopes,
    })
    .from(userConnections)
    .where(connectionFilter({ connectorId, userId }))
    .limit(1)

  if (!connection || connection.status === 'invalid') {
    fanOutReconnect(reconnects, connectorId, bucket.toolIds)
    return
  }

  if (connector.authKind === 'oauth2' && bucket.requiredScopes.size > 0) {
    const grantedScopes = new Set(normalizeScopes(connection.grantedScopes))
    const missing = Array.from(bucket.requiredScopes).filter(
      (scope) => !grantedScopes.has(scope)
    )
    if (missing.length > 0) {
      fanOutMissingScopes(reconnects, connectorId, bucket.toolIds, missing)
      return
    }
  }

  readyConnectors.add(connectorId)
}

function fanOutReconnect(
  reconnects: Reconnect[],
  connectorId: string,
  toolIds: Iterable<string>
): void {
  for (const toolId of toolIds) {
    reconnects.push({
      connectorId,
      toolId,
      reason: 'connection_unavailable',
    })
  }
}

function fanOutMissingScopes(
  reconnects: Reconnect[],
  connectorId: string,
  toolIds: Iterable<string>,
  missing: string[]
): void {
  for (const toolId of toolIds) {
    reconnects.push({ connectorId, toolId, reason: 'missing_scopes', missing })
  }
}
