import { ac, roles } from '@outname/auth/access-control'
import { sendAuthSignInOtpEmail } from '@outname/auth/server/auth-email'
import { db } from '@outname/db'
import { getRelatedProjectOrigins } from '@outname/shared/vercel-related-projects'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin as adminPlugin, emailOTP } from 'better-auth/plugins'

// Production uses Better Auth defaults. Non-production must trust the incoming
// origin and issue `SameSite=None` cookies so sign-in still works inside the
// cross-site v0 preview iframe.
const isProduction = process.env.NODE_ENV === 'production'

// Dev-only static allowlist.
const devTrustedOrigins = [
  'http://localhost:3000',
  'http://localhost:3002',
  'http://localhost:3003',
  'https://*.vercel.app',
  'https://*.vercel.run',
  'https://*.v0.app',
  'https://*.v0.dev',
  'https://*.vusercontent.net',
]

function parseAdminUserIds(): string[] {
  const raw = process.env.BETTER_AUTH_ADMIN_USER_IDS
  if (!raw) {
    return []
  }
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

function parseTrustedOriginsEnv(): string[] {
  const raw = process.env.BETTER_AUTH_TRUSTED_ORIGINS
  if (!raw) {
    return []
  }
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

function configuredTrustedOrigins(): string[] {
  return [
    process.env.BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_WEB_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_ADMIN_URL,
    process.env.NEXT_PUBLIC_API_BASE_URL,
    ...getRelatedProjectOrigins(),
    ...parseTrustedOriginsEnv(),
  ].filter((origin): origin is string => Boolean(origin))
}

function productionTrustedOrigins(): string[] | undefined {
  const origins = configuredTrustedOrigins()
  return origins.length > 0 ? origins : undefined
}

function devTrustedOriginsList(request: Request | undefined): string[] {
  const origins = [...configuredTrustedOrigins(), ...devTrustedOrigins]
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

const AUTH_EMAIL_OTP_LENGTH = 6
const AUTH_EMAIL_OTP_EXPIRES_IN_SECONDS = 60 * 10
const authCookieDomain = process.env.AUTH_COOKIE_DOMAIN?.trim()

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
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
  advanced: {
    ...(authCookieDomain
      ? {
          crossSubDomainCookies: {
            enabled: true,
            domain: authCookieDomain,
          },
        }
      : {}),
    // Only dev/preview overrides cookie attributes for the cross-site iframe.
    ...(isProduction
      ? {}
      : {
          defaultCookieAttributes: {
            httpOnly: true,
            sameSite: 'none' as const,
            secure: true,
          },
        }),
  },
  plugins: [
    adminPlugin({
      ac,
      roles,
      adminUserIds: parseAdminUserIds(),
      defaultRole: 'user',
    }),
    emailOTP({
      allowedAttempts: 5,
      disableSignUp: true,
      expiresIn: AUTH_EMAIL_OTP_EXPIRES_IN_SECONDS,
      otpLength: AUTH_EMAIL_OTP_LENGTH,
      resendStrategy: 'rotate',
      async sendVerificationOTP({ email, otp, type }) {
        if (type !== 'sign-in') {
          return
        }

        await sendAuthSignInOtpEmail({
          email,
          otp,
        })
      },
    }),
  ],
})

export type Session = typeof auth.$Infer.Session
