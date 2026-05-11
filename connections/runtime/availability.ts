import 'server-only'

import { and, eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { userConnections } from '@/shared/db/schema'
import type { Reconnect } from '@/tools/catalog/types'
import { getConnector } from '../registry'
import type { ProviderRequirement } from './types'

export interface ResolveConnectionAvailabilityResult {
  readyProviders: Set<string>
  reconnects: Reconnect[]
}

interface ProviderBucket {
  toolIds: Set<string>
}

export async function resolveConnectionAvailability(args: {
  userId: string
  requirements: ProviderRequirement[]
}): Promise<ResolveConnectionAvailabilityResult> {
  const readyProviders = new Set<string>()
  const reconnects: Reconnect[] = []
  const byProvider = bucketRequirementsByProvider(args.requirements)

  await Promise.all(
    Array.from(byProvider.entries()).map(([provider, bucket]) =>
      resolveOneProvider({
        userId: args.userId,
        provider,
        bucket,
        readyProviders,
        reconnects,
      })
    )
  )

  return { readyProviders, reconnects }
}

function bucketRequirementsByProvider(
  requirements: ProviderRequirement[]
): Map<string, ProviderBucket> {
  const byProvider = new Map<string, ProviderBucket>()
  for (const req of requirements) {
    let bucket = byProvider.get(req.provider)
    if (!bucket) {
      bucket = { toolIds: new Set() }
      byProvider.set(req.provider, bucket)
    }
    bucket.toolIds.add(req.toolId)
  }
  return byProvider
}

async function resolveOneProvider(args: {
  userId: string
  provider: string
  bucket: ProviderBucket
  readyProviders: Set<string>
  reconnects: Reconnect[]
}): Promise<void> {
  const { userId, provider, bucket, readyProviders, reconnects } = args
  const connector = getConnector(provider)
  if (!connector) {
    fanOutReconnect(reconnects, provider, bucket.toolIds)
    return
  }

  const [connection] = await db
    .select({ status: userConnections.status })
    .from(userConnections)
    .where(
      and(
        eq(userConnections.userId, userId),
        eq(userConnections.provider, provider)
      )
    )
    .limit(1)

  if (!connection || connection.status === 'invalid') {
    fanOutReconnect(reconnects, provider, bucket.toolIds)
    return
  }

  readyProviders.add(provider)
}

function fanOutReconnect(
  reconnects: Reconnect[],
  provider: string,
  toolIds: Iterable<string>
): void {
  for (const toolId of toolIds) {
    reconnects.push({ provider, toolId, reason: 'connection_unavailable' })
  }
}
