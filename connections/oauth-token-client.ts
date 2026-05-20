import 'server-only'

import type {
  Connector,
  OAuth2TokenResponse,
  StoredOAuth2CredentialBlob,
} from './types'

const SCOPE_SPLIT_PATTERN = /\s+/
const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const OAUTH_TOKEN_REQUEST_TIMEOUT_MS = 8000

type OAuth2Connector = Extract<Connector, { authKind: 'oauth2' }>

export interface OAuthClientCredentials {
  clientId: string
  clientSecret?: string
}

export type OAuthClientCredentialsResult =
  | { credentials: OAuthClientCredentials; ok: true }
  | { error: string; ok: false }

export interface NormalizedTokenResponse {
  accessToken: string
  credentials: StoredOAuth2CredentialBlob
  expiresAt: Date | null
  grantedScopes: string[]
  refreshToken?: string
}

export type TokenExchangeResult =
  | ({ ok: true } & NormalizedTokenResponse)
  | { error: string; ok: false; permanent: boolean }

export function readOAuthClientCredentials(
  connector: OAuth2Connector
): OAuthClientCredentialsResult {
  const clientId = process.env[connector.oauth2.clientIdEnv]
  const clientSecret = connector.oauth2.clientSecretEnv
    ? process.env[connector.oauth2.clientSecretEnv]
    : undefined
  if (!clientId) {
    return {
      ok: false,
      error: `${connector.oauth2.clientIdEnv} is not configured.`,
    }
  }
  return {
    ok: true,
    credentials: { clientId, clientSecret },
  }
}

export function buildOAuthClientAuthHeaders(
  clientId: string,
  clientSecret?: string
): Record<string, string> {
  const headers: Record<string, string> = {
    accept: 'application/json',
    'content-type': 'application/x-www-form-urlencoded',
  }
  if (clientSecret) {
    headers.authorization = `Basic ${base64Encode(`${clientId}:${clientSecret}`)}`
  }
  return headers
}

export async function exchangeAuthorizationCode(
  connector: OAuth2Connector,
  input: {
    code: string
    redirectUri: string
    verifier: string
  }
): Promise<TokenExchangeResult> {
  const client = readOAuthClientCredentials(connector)
  if (!client.ok) {
    return { ok: false, permanent: false, error: client.error }
  }

  return await requestOAuthToken(connector, {
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: input.code,
      redirect_uri: input.redirectUri,
      code_verifier: input.verifier,
      client_id: client.credentials.clientId,
    }),
    client: client.credentials,
    fallbackScopes: connector.oauth2.defaultScopes,
    fallbackErrorMessage: 'OAuth request failed.',
    invalidResponseMessage:
      'OAuth provider returned an invalid token response.',
    permanentFailure: () => false,
    timeoutMessage: `${connector.displayName} OAuth token exchange timed out.`,
  })
}

export async function refreshAccessToken(
  connector: OAuth2Connector,
  refreshToken: string
): Promise<TokenExchangeResult> {
  const client = readOAuthClientCredentials(connector)
  if (!client.ok) {
    return { ok: false, permanent: false, error: client.error }
  }

  return await requestOAuthToken(connector, {
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: client.credentials.clientId,
    }),
    client: client.credentials,
    fallbackScopes: [],
    fallbackErrorMessage: 'OAuth refresh failed.',
    invalidResponseMessage: `${connector.displayName} returned an invalid refresh response.`,
    permanentFailure: isPermanentOAuthRefreshFailure,
    timeoutMessage: `${connector.displayName} OAuth refresh timed out.`,
  })
}

export function formatProviderOAuthError(
  payload: Pick<OAuth2TokenResponse, 'error' | 'error_description'>,
  status: number
): string {
  const error = typeof payload.error === 'string' ? payload.error : null
  const description =
    typeof payload.error_description === 'string'
      ? payload.error_description
      : null
  return [error, description].filter(Boolean).join(': ') || `HTTP ${status}`
}

export function isPermanentOAuthRefreshFailure(
  status: number,
  rawError: unknown
): boolean {
  if (status === 401) {
    return true
  }
  if (status !== 400 || typeof rawError !== 'string') {
    return false
  }
  return rawError === 'invalid_grant' || rawError === 'invalid_request'
}

export function parseOAuth2TokenResponse(
  payload: OAuth2TokenResponse,
  options: {
    fallbackScopes: readonly string[]
    invalidResponseMessage: string
  }
): { ok: true; token: NormalizedTokenResponse } | { error: string; ok: false } {
  const invalidTokenType =
    payload.token_type !== undefined &&
    (typeof payload.token_type !== 'string' ||
      payload.token_type.toLowerCase() !== 'bearer')
  if (typeof payload.access_token !== 'string' || invalidTokenType) {
    return { ok: false, error: options.invalidResponseMessage }
  }

  const refreshToken =
    typeof payload.refresh_token === 'string'
      ? payload.refresh_token
      : undefined
  const credentials: StoredOAuth2CredentialBlob = {
    kind: 'oauth2',
    version: 1,
    tokenType: 'Bearer',
    accessToken: payload.access_token,
    refreshToken,
  }
  return {
    ok: true,
    token: {
      accessToken: payload.access_token,
      credentials,
      refreshToken,
      expiresAt:
        typeof payload.expires_in === 'number'
          ? new Date(Date.now() + payload.expires_in * 1000)
          : null,
      grantedScopes:
        typeof payload.scope === 'string'
          ? payload.scope.split(SCOPE_SPLIT_PATTERN).filter(Boolean)
          : [...options.fallbackScopes],
    },
  }
}

async function requestOAuthToken(
  connector: OAuth2Connector,
  input: {
    body: URLSearchParams
    client: OAuthClientCredentials
    fallbackErrorMessage: string
    fallbackScopes: readonly string[]
    invalidResponseMessage: string
    permanentFailure(status: number, error: unknown): boolean
    timeoutMessage: string
  }
): Promise<TokenExchangeResult> {
  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    OAUTH_TOKEN_REQUEST_TIMEOUT_MS
  )
  try {
    const response = await fetch(connector.oauth2.tokenUrl, {
      body: input.body,
      headers: buildOAuthClientAuthHeaders(
        input.client.clientId,
        input.client.clientSecret
      ),
      method: 'POST',
      signal: controller.signal,
    })
    const payload = (await response.json().catch((error) => {
      if (isAbortError(error)) {
        throw error
      }
      return {}
    })) as OAuth2TokenResponse
    if (!response.ok) {
      return {
        ok: false,
        permanent: input.permanentFailure(response.status, payload.error),
        error: formatProviderOAuthError(payload, response.status),
      }
    }

    const parsed = parseOAuth2TokenResponse(payload, {
      fallbackScopes: input.fallbackScopes,
      invalidResponseMessage: input.invalidResponseMessage,
    })
    if (!parsed.ok) {
      return { ok: false, permanent: false, error: parsed.error }
    }
    return { ok: true, ...parsed.token }
  } catch (error) {
    return {
      ok: false,
      permanent: false,
      error: oauthRequestErrorMessage(error, input),
    }
  } finally {
    clearTimeout(timeout)
  }
}

function oauthRequestErrorMessage(
  error: unknown,
  input: {
    fallbackErrorMessage: string
    timeoutMessage: string
  }
): string {
  if (isAbortError(error)) {
    return input.timeoutMessage
  }
  if (error instanceof Error) {
    return error.message
  }
  return input.fallbackErrorMessage
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

function base64Encode(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let output = ''
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0
    const second = bytes[index + 1] ?? 0
    const third = bytes[index + 2] ?? 0
    const triplet = first * 65_536 + second * 256 + third
    output += BASE64_ALPHABET.charAt(Math.floor(triplet / 262_144) % 64)
    output += BASE64_ALPHABET.charAt(Math.floor(triplet / 4096) % 64)
    output +=
      index + 1 < bytes.length
        ? BASE64_ALPHABET.charAt(Math.floor(triplet / 64) % 64)
        : '='
    output +=
      index + 2 < bytes.length ? BASE64_ALPHABET.charAt(triplet % 64) : '='
  }
  return output
}
