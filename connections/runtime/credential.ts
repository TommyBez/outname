import 'server-only'

import { and, eq } from 'drizzle-orm'
import { decryptCredential } from '@/connections/crypto'
import { db } from '@/shared/db'
import { userConnections } from '@/shared/db/schema'
import { getConnector } from '../registry'
import type { RawCredential } from '../types'
import { markInvalid } from './store'

export class BrokerCredentialUnavailableError extends Error {
  readonly code = 'connection_unavailable' as const
  readonly provider: string

  constructor(provider: string, message: string) {
    super(message)
    this.provider = provider
    this.name = 'BrokerCredentialUnavailableError'
  }
}

export async function readBrokeredCredential(args: {
  provider: string
  userId: string
}): Promise<RawCredential> {
  const connector = getConnector(args.provider)
  if (!connector) {
    throw new BrokerCredentialUnavailableError(
      args.provider,
      `Unknown provider: ${args.provider}`
    )
  }

  const [row] = await db
    .select({
      credentials: userConnections.credentials,
      status: userConnections.status,
    })
    .from(userConnections)
    .where(
      and(
        eq(userConnections.userId, args.userId),
        eq(userConnections.provider, args.provider)
      )
    )
    .limit(1)

  if (!row || row.status === 'invalid') {
    throw new BrokerCredentialUnavailableError(
      args.provider,
      `Connection for ${args.provider} is missing or invalid.`
    )
  }

  const raw = await decryptStoredCredential({
    encrypted: row.credentials,
    provider: args.provider,
    userId: args.userId,
  })
  const parsed = connector.apiKey.formSchema.safeParse(raw)
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? 'Stored credential shape is invalid.'
    await markInvalid({
      userId: args.userId,
      provider: args.provider,
      error: message,
    })
    throw new BrokerCredentialUnavailableError(args.provider, message)
  }

  return parsed.data
}

async function decryptStoredCredential(input: {
  encrypted: string
  provider: string
  userId: string
}): Promise<RawCredential> {
  try {
    return await decryptCredential(input.encrypted)
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : 'Stored credential could not decrypt.'
    await markInvalid({
      userId: input.userId,
      provider: input.provider,
      error: message,
    })
    throw new BrokerCredentialUnavailableError(input.provider, message)
  }
}
