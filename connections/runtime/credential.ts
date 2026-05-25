import 'server-only'

import { setTimeout as sleep } from 'node:timers/promises'
import { nanoid } from 'nanoid'
import { decryptCredential } from '@/connections/crypto'
import { db } from '@/shared/db/pool'
import { userConnections } from '@/shared/db/schema'
import { getUpstashRedis } from '@/shared/server/upstash-redis'
import { refreshAccessToken } from '../oauth-token-client'
import { getConnector } from '../registry'
import type {
  Connector,
  RawCredential,
  StoredOAuth2CredentialBlob,
} from '../types'
import { connectionFilter } from './connection-query'
import { normalizeScopes } from './scopes'
import { markInvalid, updateOAuth2ConnectionTokens } from './store'

const OAUTH_PRE_REFRESH_WINDOW_MS = 20 * 60 * 1000
const REFRESH_LOCK_TTL_SECONDS = 10
const REFRESH_WAIT_ATTEMPTS = 50
const REFRESH_WAIT_BASE_MS = 250
const FINGERPRINT_HEX_LENGTH = 16

export class BrokerCredentialUnavailableError extends Error {
  readonly code = 'connection_unavailable' as const
  readonly connectorId: string

  constructor(connectorId: string, message: string) {
    super(message)
    this.connectorId = connectorId
    this.name = 'BrokerCredentialUnavailableError'
  }
}

export interface ConnectorCredentialResult {
  credential: RawCredential
  tokenFingerprint: string
}

export async function readConnectorCredential(args: {
  connectorId: string
  userId: string
}): Promise<ConnectorCredentialResult> {
  'use step'
  const connector = getConnector(args.connectorId)
  if (!connector) {
    throw new BrokerCredentialUnavailableError(
      args.connectorId,
      `Unknown connector: ${args.connectorId}`
    )
  }

  const row = await readConnectionRow(args)
  if (!row || row.status === 'invalid') {
    throw new BrokerCredentialUnavailableError(
      args.connectorId,
      `Connection for ${connector.displayName} is missing or invalid.`
    )
  }

  const raw = await decryptStoredCredential({
    encrypted: row.credentials,
    connectorId: args.connectorId,
    userId: args.userId,
  })

  if (connector.authKind === 'api_key') {
    const values = extractApiKeyValues(raw)
    const parsed = connector.apiKey.formSchema.safeParse(values)
    if (!parsed.success) {
      const message =
        parsed.error.issues[0]?.message ?? 'Stored credential shape is invalid.'
      await markInvalid({
        userId: args.userId,
        connectorId: args.connectorId,
        error: message,
      })
      throw new BrokerCredentialUnavailableError(args.connectorId, message)
    }
    return {
      credential: parsed.data,
      tokenFingerprint: await credentialFingerprint(parsed.data),
    }
  }

  const credential = await extractOAuth2CredentialOrMarkInvalid({
    raw,
    connectorId: args.connectorId,
    userId: args.userId,
  })
  const refreshed = await refreshOAuth2IfNeeded({
    connector,
    credential,
    expiresAt: row.expiresAt,
    grantedScopes: normalizeScopes(row.grantedScopes),
    userId: args.userId,
  })
  return {
    credential: refreshed,
    tokenFingerprint: await tokenFingerprint(refreshed.accessToken),
  }
}

async function readConnectionRow(args: {
  connectorId: string
  userId: string
}) {
  const [row] = await db
    .select({
      credentials: userConnections.credentials,
      expiresAt: userConnections.expiresAt,
      grantedScopes: userConnections.grantedScopes,
      status: userConnections.status,
    })
    .from(userConnections)
    .where(connectionFilter(args))
    .limit(1)
  return row ?? null
}

async function decryptStoredCredential(input: {
  encrypted: string
  connectorId: string
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
      connectorId: input.connectorId,
      error: message,
    })
    throw new BrokerCredentialUnavailableError(input.connectorId, message)
  }
}

function extractApiKeyValues(raw: RawCredential): unknown {
  if (
    typeof raw === 'object' &&
    raw !== null &&
    'kind' in raw &&
    raw.kind === 'api_key' &&
    'values' in raw
  ) {
    return raw.values
  }
  return raw
}

function extractOAuth2Credential(
  raw: RawCredential,
  connectorId: string
): StoredOAuth2CredentialBlob {
  if (
    typeof raw === 'object' &&
    raw !== null &&
    'kind' in raw &&
    raw.kind === 'oauth2' &&
    'version' in raw &&
    raw.version === 1 &&
    'accessToken' in raw &&
    typeof raw.accessToken === 'string' &&
    'tokenType' in raw &&
    raw.tokenType === 'Bearer'
  ) {
    return raw as StoredOAuth2CredentialBlob
  }
  throw new BrokerCredentialUnavailableError(
    connectorId,
    'Stored OAuth credential shape is invalid.'
  )
}

async function extractOAuth2CredentialOrMarkInvalid(input: {
  raw: RawCredential
  connectorId: string
  userId: string
}): Promise<StoredOAuth2CredentialBlob> {
  try {
    return extractOAuth2Credential(input.raw, input.connectorId)
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : 'Stored OAuth credential shape is invalid.'
    await markInvalid({
      userId: input.userId,
      connectorId: input.connectorId,
      error: message,
    })
    throw err
  }
}

async function refreshOAuth2IfNeeded(input: {
  connector: Extract<Connector, { authKind: 'oauth2' }>
  credential: StoredOAuth2CredentialBlob
  expiresAt: Date | null
  grantedScopes: string[]
  userId: string
}): Promise<StoredOAuth2CredentialBlob> {
  if (!shouldRefresh(input.expiresAt)) {
    return input.credential
  }
  if (!input.credential.refreshToken) {
    if (!isExpired(input.expiresAt)) {
      return input.credential
    }
    const message = `${input.connector.displayName} token is expired and has no refresh token.`
    await markInvalid({
      userId: input.userId,
      connectorId: input.connector.connectorId,
      error: message,
    })
    throw new BrokerCredentialUnavailableError(
      input.connector.connectorId,
      message
    )
  }

  return await withOAuthRefreshSingleFlight({
    connectorId: input.connector.connectorId,
    userId: input.userId,
    refresh: () => refreshOAuth2Credential(input),
  })
}

function shouldRefresh(expiresAt: Date | null): boolean {
  if (!expiresAt) {
    return false
  }
  return expiresAt.getTime() < Date.now() + OAUTH_PRE_REFRESH_WINDOW_MS
}

function isExpired(expiresAt: Date | null): boolean {
  return expiresAt !== null && expiresAt.getTime() <= Date.now()
}

async function withOAuthRefreshSingleFlight(input: {
  connectorId: string
  userId: string
  refresh: () => Promise<StoredOAuth2CredentialBlob>
}): Promise<StoredOAuth2CredentialBlob> {
  const redis = getUpstashRedis()
  if (!redis) {
    throw new Error('Redis is required for OAuth token refresh locking.')
  }

  const key = `oauth-refresh:${input.userId}:${input.connectorId}`
  const token = nanoid(16)
  for (let attempt = 0; attempt < REFRESH_WAIT_ATTEMPTS; attempt += 1) {
    const acquired = await redis.set(key, token, {
      ex: REFRESH_LOCK_TTL_SECONDS,
      nx: true,
    })
    if (acquired === 'OK') {
      try {
        return await input.refresh()
      } finally {
        const current = await redis.get<string>(key)
        if (current === token) {
          await redis.del(key)
        }
      }
    }

    await sleep(REFRESH_WAIT_BASE_MS + randomJitterMs())
    const row = await readConnectionRow(input)
    if (!row || row.status === 'invalid') {
      throw new BrokerCredentialUnavailableError(
        input.connectorId,
        `Connection for ${input.connectorId} is missing or invalid.`
      )
    }
    if (!shouldRefresh(row.expiresAt)) {
      const raw = await decryptStoredCredential({
        encrypted: row.credentials,
        connectorId: input.connectorId,
        userId: input.userId,
      })
      return await extractOAuth2CredentialOrMarkInvalid({
        raw,
        connectorId: input.connectorId,
        userId: input.userId,
      })
    }
  }

  throw new Error(
    `Timed out waiting for OAuth refresh lock for ${input.connectorId}.`
  )
}

async function refreshOAuth2Credential(input: {
  connector: Extract<Connector, { authKind: 'oauth2' }>
  credential: StoredOAuth2CredentialBlob
  expiresAt: Date | null
  grantedScopes: string[]
  userId: string
}): Promise<StoredOAuth2CredentialBlob> {
  const latestRow = await readConnectionRow({
    connectorId: input.connector.connectorId,
    userId: input.userId,
  })
  if (!latestRow || latestRow.status === 'invalid') {
    throw new BrokerCredentialUnavailableError(
      input.connector.connectorId,
      `Connection for ${input.connector.displayName} is missing or invalid.`
    )
  }
  if (!shouldRefresh(latestRow.expiresAt)) {
    const latestRaw = await decryptStoredCredential({
      encrypted: latestRow.credentials,
      connectorId: input.connector.connectorId,
      userId: input.userId,
    })
    return await extractOAuth2CredentialOrMarkInvalid({
      raw: latestRaw,
      connectorId: input.connector.connectorId,
      userId: input.userId,
    })
  }

  const tokenResponse = await refreshAccessToken(
    input.connector,
    input.credential.refreshToken ?? ''
  )
  if (!tokenResponse.ok) {
    if (tokenResponse.permanent) {
      await markInvalid({
        connectorId: input.connector.connectorId,
        userId: input.userId,
        error: tokenResponse.error,
      })
    }
    throw new BrokerCredentialUnavailableError(
      input.connector.connectorId,
      tokenResponse.error
    )
  }

  const nextCredential: StoredOAuth2CredentialBlob = {
    kind: 'oauth2',
    version: 1,
    tokenType: 'Bearer',
    accessToken: tokenResponse.accessToken,
    refreshToken: tokenResponse.refreshToken ?? input.credential.refreshToken,
  }
  const grantedScopes =
    tokenResponse.grantedScopes.length > 0
      ? tokenResponse.grantedScopes
      : normalizeScopes(latestRow.grantedScopes)
  await updateOAuth2ConnectionTokens({
    connectorId: input.connector.connectorId,
    userId: input.userId,
    credentials: nextCredential,
    expiresAt: tokenResponse.expiresAt,
    grantedScopes,
  })
  return nextCredential
}

export async function tokenFingerprint(token: string): Promise<string> {
  'use step'
  const { createHash } = await import('node:crypto')
  return createHash('sha256')
    .update(token)
    .digest('hex')
    .slice(0, FINGERPRINT_HEX_LENGTH)
}

export async function credentialFingerprint(
  credential: unknown
): Promise<string> {
  return await tokenFingerprint(stableCredentialPayload(credential))
}

function stableCredentialPayload(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'undefined'
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableCredentialPayload).join(',')}]`
  }

  const record = value as Record<string, unknown>
  const entries = Object.keys(record)
    .sort()
    .map(
      (key) => `${JSON.stringify(key)}:${stableCredentialPayload(record[key])}`
    )
  return `{${entries.join(',')}}`
}

function randomJitterMs(): number {
  return Math.floor(Math.random() * 150)
}
