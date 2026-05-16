import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin as adminPlugin, emailOTP } from 'better-auth/plugins'
import { createElement } from 'react'
import { ac, roles } from '@/auth/access-control'
import { AuthSignInOtpEmail } from '@/emails/auth-sign-in-otp-email'
import { db } from '@/shared/db'
import { sendTransactionalEmail } from '@/shared/server/resend'
import { siteConfig } from '@/shared/server/site-metadata'

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

const AUTH_EMAIL_OTP_LENGTH = 6
const AUTH_EMAIL_OTP_EXPIRES_IN_SECONDS = 60 * 10

function getBaseUrl(): string {
  return process.env.BETTER_AUTH_URL || siteConfig.url
}

function getEmailLogoUrl(): string {
  return `${getBaseUrl()}/email/outna-logo.png`
}

function createOtpIdempotencyKey(email: string, otp: string): string {
  return `auth-email-otp/${encodeURIComponent(email.toLowerCase())}/${otp}`
}

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

        await sendTransactionalEmail({
          idempotencyKey: createOtpIdempotencyKey(email, otp),
          subject: 'Your OUTNA.ME sign-in code',
          to: email,
          react: createElement(AuthSignInOtpEmail, {
            code: otp,
            expiresInMinutes: AUTH_EMAIL_OTP_EXPIRES_IN_SECONDS / 60,
            loginUrl: `${getBaseUrl()}/login`,
            logoUrl: getEmailLogoUrl(),
          }),
        })
      },
    }),
  ],
})

export type Session = typeof auth.$Infer.Session
