import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '@/shared/db'

// Production uses Better Auth defaults. Non-production must trust the incoming
// origin and issue `SameSite=None` cookies so sign-in still works inside the
// cross-site v0 preview iframe.
const isProduction = process.env.NODE_ENV === 'production'

// Dev-only static allowlist.
const devTrustedOrigins = [
  'http://localhost:3000',
  'https://*.vercel.app',
  'https://*.vercel.run',
  'https://*.v0.app',
  'https://*.v0.dev',
  'https://*.vusercontent.net',
]

function productionTrustedOrigins(): string[] | undefined {
  const url = process.env.BETTER_AUTH_URL
  if (url) {
    return [url]
  }
  return
}

function devTrustedOriginsList(request: Request | undefined): string[] {
  const origins = [
    ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
    ...devTrustedOrigins,
  ]
  if (request && typeof request.headers?.get === 'function') {
    const originHeader =
      request.headers.get('origin') || request.headers.get('referer')
    if (originHeader) {
      try {
        origins.push(new URL(originHeader).origin)
      } catch {
        // ignore invalid URLs
      }
    }
  }
  return origins
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    // Registration stays disabled; the seeded admin is created out of band.
    disableSignUp: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  // Dev trusts the incoming origin plus the static allowlist for local and v0
  // previews; production trusts only `BETTER_AUTH_URL`.
  trustedOrigins: isProduction
    ? productionTrustedOrigins()
    : (request) => devTrustedOriginsList(request),
  // Only dev/preview overrides cookie attributes for the cross-site iframe.
  ...(isProduction
    ? {}
    : {
        advanced: {
          defaultCookieAttributes: {
            sameSite: 'none' as const,
            secure: true,
            httpOnly: true,
          },
        },
      }),
})

export type Session = typeof auth.$Infer.Session
