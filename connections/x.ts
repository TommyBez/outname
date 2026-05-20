import 'server-only'
import { z } from 'zod'
import { defineConnector, defineOAuth2Connector } from './define-connector'
import type { StoredOAuth2CredentialBlob } from './types'

const BEARER_PREFIX_PATTERN = /^bearer(?:\s+|$)/i
const WHITESPACE_PATTERN = /\s/
const X_API_BASE = 'https://api.x.com'
const X_OAUTH_SCOPES = [
  'tweet.read',
  'tweet.write',
  'users.read',
  'offline.access',
  'like.read',
  'like.write',
  'follows.read',
  'follows.write',
  'bookmark.read',
  'bookmark.write',
  'media.write',
] as const
const X_OAUTH_SCOPE_CATALOG = [
  { scope: 'tweet.read', label: 'Read tweets' },
  { scope: 'tweet.write', label: 'Post and manage tweets' },
  { scope: 'users.read', label: 'Read user profiles' },
  { scope: 'offline.access', label: 'Stay connected offline' },
  { scope: 'like.read', label: 'Read likes' },
  { scope: 'like.write', label: 'Like and unlike tweets' },
  { scope: 'follows.read', label: 'Read follows' },
  { scope: 'follows.write', label: 'Follow and unfollow accounts' },
  { scope: 'bookmark.read', label: 'Read bookmarks' },
  { scope: 'bookmark.write', label: 'Manage bookmarks' },
  { scope: 'media.write', label: 'Upload media' },
] as const

const xBearerTokenSchema = z.preprocess(
  (value) =>
    typeof value === 'string'
      ? value.trim().replace(BEARER_PREFIX_PATTERN, '')
      : value,
  z
    .string()
    .min(1, 'Required')
    .refine(
      (value) => !WHITESPACE_PATTERN.test(value),
      'Paste only the token value, without spaces.'
    )
)

const xCredentialSchema = z.object({
  bearerToken: xBearerTokenSchema,
})

export type XCredential = z.infer<typeof xCredentialSchema>

export const xConnector = defineConnector('x.bearer_token', {
  displayName: 'X API · App Bearer',
  description:
    'X API v2 app-only access via Bearer Token. This connector does not act as an X user.',
  surface: 'app_only',
  credential: xCredentialSchema,
  fields: [
    {
      name: 'bearerToken',
      label: 'App Bearer token',
      type: 'password',
      placeholder: 'Paste an app-only Bearer token',
      description:
        'Generate in the X Developer Console. OAuth user-context tokens are handled by the X API · OAuth User connector.',
    },
  ],
  broker: {
    allowedHosts: ['api.x.com'] as const,
    injectedHeaderNames: ['authorization'] as const,
    injectedHeaders: (credential: XCredential) => ({
      authorization: `Bearer ${credential.bearerToken}`,
    }),
  },
})

async function xOAuthProfile(
  accessToken: string
): Promise<Record<string, unknown>> {
  const response = await fetch(`${X_API_BASE}/2/users/me`, {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  })
  if (!response.ok) {
    throw new Error(`X profile lookup failed (HTTP ${response.status}).`)
  }
  const payload = (await response.json()) as {
    data?: {
      id?: string
      name?: string
      username?: string
    }
  }
  const data = payload.data ?? {}
  return {
    ...(data.id ? { accountId: data.id } : {}),
    ...(data.username ? { username: data.username } : {}),
    ...(data.name ? { displayName: data.name } : {}),
  }
}

export const xOAuthConnector = defineOAuth2Connector('x.oauth2_user', {
  providerGroup: 'x',
  surface: 'user_context',
  displayName: 'X API · OAuth User',
  description:
    'X API v2 user-context access for posting, likes, follows, bookmarks, and media. media.write requires support in your X developer plan and app configuration.',
  broker: {
    allowedHosts: ['api.x.com'] as const,
    injectedHeaderNames: ['authorization'] as const,
    injectedHeaders: (credential: StoredOAuth2CredentialBlob) => ({
      authorization: `${credential.tokenType} ${credential.accessToken}`,
    }),
  },
  oauth2: {
    authorizationUrl: 'https://x.com/i/oauth2/authorize',
    tokenUrl: `${X_API_BASE}/2/oauth2/token`,
    revokeUrl: `${X_API_BASE}/2/oauth2/revoke`,
    clientIdEnv: 'X_OAUTH_CLIENT_ID',
    clientSecretEnv: 'X_OAUTH_CLIENT_SECRET',
    defaultScopes: X_OAUTH_SCOPES,
    pkce: { method: 'S256' },
    profile: xOAuthProfile,
    scopeCatalog: X_OAUTH_SCOPE_CATALOG,
  },
})
