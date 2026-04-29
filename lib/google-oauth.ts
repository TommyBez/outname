import 'server-only'
import { neon } from '@neondatabase/serverless'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/neon-http'
import { cacheLife, cacheTag } from 'next/cache'
import { gmailConnectionTag } from '@/lib/cache-tags'
import { gmailConnection } from '@/lib/db/schema'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is not set`)
  }
  return value
}

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ')

export function getRedirectUri(requestUrl?: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (requestUrl ? new URL(requestUrl).origin : 'http://localhost:3000')
  return `${base}/api/google/callback`
}

export function buildAuthorizeUrl(state: string, redirectUri: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID is not set')
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GMAIL_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

interface TokenResponse {
  access_token: string
  expires_in: number
  id_token?: string
  refresh_token?: string
  scope: string
  token_type: string
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<TokenResponse> {
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
    throw new Error(`Token exchange failed: ${res.status} ${text}`)
  }
  return res.json()
}

export async function fetchUserEmail(accessToken: string): Promise<string> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    throw new Error(`userinfo failed: ${res.status}`)
  }
  const json = (await res.json()) as { email: string }
  return json.email
}

export async function revokeToken(token: string): Promise<void> {
  try {
    await fetch(
      `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
      {
        method: 'POST',
      }
    )
  } catch {
    /* best effort */
  }
}

function getDb() {
  const sql = neon(requireEnv('DATABASE_URL'))
  return drizzle(sql, { schema: { gmailConnection } })
}

export async function getGmailConnection() {
  const db = getDb()
  const [row] = await db.select().from(gmailConnection).limit(1)
  return row ?? null
}

export async function getGmailConnectionForUser(userId: string) {
  const db = getDb()
  const [row] = await db
    .select()
    .from(gmailConnection)
    .where(eq(gmailConnection.userId, userId))
    .limit(1)
  return row ?? null
}

export async function getCachedGmailConnectionForUser(userId: string) {
  'use cache'

  cacheLife('minutes')
  cacheTag(gmailConnectionTag(userId))
  return await getGmailConnectionForUser(userId)
}

export async function upsertGmailConnection(values: {
  userId: string
  email: string
  refreshToken: string
  accessToken: string
  accessTokenExpiresAt: Date
  scopes: string
}) {
  const db = getDb()
  const existing = await getGmailConnectionForUser(values.userId)
  if (existing) {
    await db
      .update(gmailConnection)
      .set({
        email: values.email,
        refreshToken: values.refreshToken,
        accessToken: values.accessToken,
        accessTokenExpiresAt: values.accessTokenExpiresAt,
        scopes: values.scopes,
        status: 'active',
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(gmailConnection.id, existing.id))
  } else {
    await db.insert(gmailConnection).values({
      id: 'singleton',
      userId: values.userId,
      email: values.email,
      refreshToken: values.refreshToken,
      accessToken: values.accessToken,
      accessTokenExpiresAt: values.accessTokenExpiresAt,
      scopes: values.scopes,
      status: 'active',
    })
  }
}

export async function markConnectionExpired(err: string) {
  const db = getDb()
  await db
    .update(gmailConnection)
    .set({ status: 'expired', lastError: err, updatedAt: new Date() })
}

export async function deleteGmailConnection(userId?: string) {
  const db = getDb()
  const existing = userId
    ? await getGmailConnectionForUser(userId)
    : await getGmailConnection()
  if (existing?.refreshToken) {
    await revokeToken(existing.refreshToken)
  }
  if (existing) {
    await db.delete(gmailConnection).where(eq(gmailConnection.id, existing.id))
  }
}
