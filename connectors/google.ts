import 'server-only'
import type {
  OAuthConnector,
  OAuthExchangeResult,
  RawCredential,
} from './types'

/**
 * Google OAuth 2.0 connector. A single `google` connection backs every
 * Google-API tool the platform ships — Gmail, Calendar, Drive, etc.
 * Per-tool scope unioning is handled by `connectors/runtime.ts` when
 * building the authorize URL.
 *
 * Stored credential shape:
 *
 *     {
 *       refreshToken: string,
 *       accessToken: string,
 *       accessTokenExpiresAt: string  // ISO
 *     }
 *
 * The runtime looks at `expiresAt` (the column, mirrored from above)
 * to decide when to refresh.
 */

interface GoogleCredential {
  refreshToken: string
  accessToken: string
  accessTokenExpiresAt: string
}

interface GoogleTokenResponse {
  access_token: string
  expires_in: number
  refresh_token?: string
  scope?: string
  token_type: string
  id_token?: string
}

interface GoogleUserInfo {
  email?: string
  id?: string
  name?: string
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is not set`)
  }
  return value
}

async function fetchUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    return {}
  }
  return (await res.json()) as GoogleUserInfo
}

export const googleConnector: OAuthConnector = {
  provider: 'google',
  kind: 'oauth',
  displayName: 'Google',
  description:
    'Single OAuth connection used by every Google-API tool (Gmail, Calendar, Drive, …). Scopes are unioned from the agent’s attached tools at connect time.',
  oauth: {
    buildAuthorizeUrl({ state, redirectUri, scopes }) {
      const clientId = requireEnv('GOOGLE_CLIENT_ID')
      // userinfo.email is always included so we can cache the account
      // identity in `metadata.email`. Tools never request it themselves.
      const allScopes = Array.from(
        new Set(['https://www.googleapis.com/auth/userinfo.email', ...scopes])
      )
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: allScopes.join(' '),
        access_type: 'offline',
        // `consent` forces the refresh-token roundtrip even if the user
        // already authorised this client at a smaller scope set.
        prompt: 'consent',
        include_granted_scopes: 'true',
        state,
      })
      return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
    },

    async exchangeCode({ code, redirectUri }): Promise<OAuthExchangeResult> {
      const clientId = requireEnv('GOOGLE_CLIENT_ID')
      const clientSecret = requireEnv('GOOGLE_CLIENT_SECRET')
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`google.exchangeCode: ${res.status} ${text}`)
      }
      const tokens = (await res.json()) as GoogleTokenResponse
      if (!tokens.refresh_token) {
        // `prompt=consent` should always return one; if Google still
        // omits it the user has the previous app variant locked down
        // and we'd lose offline access on the next refresh.
        throw new Error('google.exchangeCode: no refresh_token in response')
      }
      const accessTokenExpiresAt = new Date(
        Date.now() + tokens.expires_in * 1000
      ).toISOString()
      const userInfo = await fetchUserInfo(tokens.access_token)
      const grantedScopes = (tokens.scope ?? '').split(' ').filter(Boolean)
      const raw: GoogleCredential = {
        refreshToken: tokens.refresh_token,
        accessToken: tokens.access_token,
        accessTokenExpiresAt,
      }
      return {
        raw,
        expiresAt: accessTokenExpiresAt,
        grantedScopes,
        metadata: {
          email: userInfo.email ?? null,
          accountId: userInfo.id ?? null,
        },
      }
    },

    async refresh(raw: RawCredential): Promise<OAuthExchangeResult> {
      const cred = raw as GoogleCredential
      const clientId = requireEnv('GOOGLE_CLIENT_ID')
      const clientSecret = requireEnv('GOOGLE_CLIENT_SECRET')
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: cred.refreshToken,
          grant_type: 'refresh_token',
        }),
      })
      if (!res.ok) {
        const text = await res.text()
        // Throw — runtime catches and classifies into expired/revoked.
        const err = new Error(`google.refresh: ${res.status} ${text}`)
        ;(err as Error & { status?: number }).status = res.status
        throw err
      }
      const tokens = (await res.json()) as GoogleTokenResponse
      const accessTokenExpiresAt = new Date(
        Date.now() + tokens.expires_in * 1000
      ).toISOString()
      const grantedScopes = (tokens.scope ?? '').split(' ').filter(Boolean)
      // Refresh responses don't always carry a fresh `refresh_token`;
      // when absent we keep the existing one.
      const refreshToken = tokens.refresh_token ?? cred.refreshToken
      const next: GoogleCredential = {
        refreshToken,
        accessToken: tokens.access_token,
        accessTokenExpiresAt,
      }
      return {
        raw: next,
        expiresAt: accessTokenExpiresAt,
        grantedScopes,
        metadata: {},
      }
    },

    async revoke(raw: RawCredential): Promise<void> {
      const cred = raw as GoogleCredential
      try {
        await fetch(
          `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(
            cred.refreshToken
          )}`,
          { method: 'POST' }
        )
      } catch {
        // best-effort
      }
    },
  },
}

/**
 * Helper for tools sitting on top of the Google connector: extract a
 * usable access token without leaking the refresh token. Runtime
 * guarantees the credential is fresh by the time tools see it.
 */
export function googleAccessToken(raw: RawCredential): string {
  const cred = raw as GoogleCredential
  return cred.accessToken
}
