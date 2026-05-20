import 'server-only'

import { Buffer } from 'node:buffer'
import { setTimeout as sleep } from 'node:timers/promises'
import { and, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { decryptCredential } from '@/connections/crypto'
import { db } from '@/shared/db'
import { userConnections } from '@/shared/db/schema'
import { getUpstashRedis } from '@/shared/server/upstash-redis'
import { getConnector } from '../registry'
import type {
  Connector,
  RawCredential,
  StoredOAuth2CredentialBlob,
} from '../types'
import { markInvalid, updateOAuth2ConnectionTokens } from './store'

const OAUTH_PRE_REFRESH_WINDOW_MS = 20 * 60 * 1000
const REFRESH_LOCK_TTL_SECONDS = 10
const REFRESH_WAIT_ATTEMPTS = 50
const REFRESH_WAIT_BASE_MS = 250
const SCOPE_SPLIT_PATTERN = /\s+/

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

  const credential = extractOAuth2Credential(raw, args.connectorId)
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
    .where(
      and(
        eq(userConnections.userId, args.userId),
        eq(userConnections.connectorId, args.connectorId)
      )
    )
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
    throw new BrokerCredentialUnavailableError(
      input.connector.connectorId,
      `${input.connector.displayName} token is expired and has no refresh token.`
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
      return extractOAuth2Credential(raw, input.connectorId)
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
    return extractOAuth2Credential(latestRaw, input.connector.connectorId)
  }

  const tokenResponse = await requestRefreshToken(input)
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

type RefreshTokenResult =
  | {
      accessToken: string
      expiresAt: Date | null
      grantedScopes: string[]
      ok: true
      refreshToken?: string
    }
  | { error: string; ok: false; permanent: boolean }

async function requestRefreshToken(input: {
  connector: Extract<Connector, { authKind: 'oauth2' }>
  credential: StoredOAuth2CredentialBlob
}): Promise<RefreshTokenResult> {
  const clientId = process.env[input.connector.oauth2.clientIdEnv]
  const clientSecret = input.connector.oauth2.clientSecretEnv
    ? process.env[input.connector.oauth2.clientSecretEnv]
    : undefined
  if (!clientId) {
    return {
      ok: false,
      permanent: false,
      error: `${input.connector.oauth2.clientIdEnv} is not configured.`,
    }
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: input.credential.refreshToken ?? '',
    client_id: clientId,
  })
  const headers: Record<string, string> = {
    accept: 'application/json',
    'content-type': 'application/x-www-form-urlencoded',
  }
  if (clientSecret) {
    headers.authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
  }

  try {
    const response = await fetch(input.connector.oauth2.tokenUrl, {
      body,
      headers,
      method: 'POST',
    })
    const payload = (await response.json().catch(() => ({}))) as {
      access_token?: unknown
      error?: unknown
      error_description?: unknown
      expires_in?: unknown
      refresh_token?: unknown
      scope?: unknown
      token_type?: unknown
    }
    if (!response.ok) {
      const error = providerOAuthError(payload, response.status)
      return {
        ok: false,
        permanent: isPermanentRefreshFailure(response.status, payload.error),
        error,
      }
    }
    if (
      typeof payload.access_token !== 'string' ||
      (payload.token_type !== undefined && payload.token_type !== 'Bearer')
    ) {
      return {
        ok: false,
        permanent: false,
        error: `${input.connector.displayName} returned an invalid refresh response.`,
      }
    }
    return {
      ok: true,
      accessToken: payload.access_token,
      refreshToken:
        typeof payload.refresh_token === 'string'
          ? payload.refresh_token
          : undefined,
      expiresAt:
        typeof payload.expires_in === 'number'
          ? new Date(Date.now() + payload.expires_in * 1000)
          : null,
      grantedScopes:
        typeof payload.scope === 'string'
          ? payload.scope.split(SCOPE_SPLIT_PATTERN).filter(Boolean)
          : [],
    }
  } catch (error) {
    return {
      ok: false,
      permanent: false,
      error: error instanceof Error ? error.message : 'OAuth refresh failed.',
    }
  }
}

function isPermanentRefreshFailure(status: number, rawError: unknown): boolean {
  if (status === 401) {
    return true
  }
  if (status !== 400 || typeof rawError !== 'string') {
    return false
  }
  return rawError === 'invalid_grant' || rawError === 'invalid_request'
}

function providerOAuthError(
  payload: { error?: unknown; error_description?: unknown },
  status: number
): string {
  const error = typeof payload.error === 'string' ? payload.error : null
  const description =
    typeof payload.error_description === 'string'
      ? payload.error_description
      : null
  return [error, description].filter(Boolean).join(': ') || `HTTP ${status}`
}

function normalizeScopes(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((item): item is string => typeof item === 'string')
}

export async function tokenFingerprint(token: string): Promise<string> {
  'use step'
  const { createHash } = await import('node:crypto')
  return createHash('sha256').update(token).digest('hex').slice(0, 8)
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
