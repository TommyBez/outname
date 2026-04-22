import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { db } from "@/lib/db"

// In production, the app runs at its own origin (BETTER_AUTH_URL) and is
// NOT embedded in a cross-site iframe, so we keep Better Auth's stock
// defaults: trustedOrigins = [BETTER_AUTH_URL] and SameSite=Lax cookies.
//
// In non-production (local dev + the v0 integrated preview, which embeds
// the app in a cross-site iframe on a dynamic sandbox host), we need to:
//   1. Trust the incoming Origin so CSRF checks don't reject sign-in.
//   2. Issue session cookies with SameSite=None; Secure so the browser
//      actually stores and sends them back from inside the iframe.
const isProduction = process.env.NODE_ENV === "production"

// Dev-only static allowlist. Never used in production.
const devTrustedOrigins = [
  "http://localhost:3000",
  "https://*.vercel.app",
  "https://*.vercel.run",
  "https://*.v0.app",
  "https://*.v0.dev",
  "https://*.vusercontent.net",
]

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    // Single-user: registration is disabled at route level via middleware.
    // Admin is created via a seed script.
    disableSignUp: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  // In production: identical to the original config — only BETTER_AUTH_URL
  // is trusted. In dev: trust the incoming origin + a static allowlist so
  // the v0 sandbox and local dev work without per-host configuration.
  trustedOrigins: isProduction
    ? process.env.BETTER_AUTH_URL
      ? [process.env.BETTER_AUTH_URL]
      : undefined
    : async (request) => {
        const origins = [
          ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
          ...devTrustedOrigins,
        ]
        // `request` can be undefined when Better Auth invokes this from
        // non-HTTP contexts (e.g. during initialization), so guard it.
        if (request && typeof request.headers?.get === "function") {
          const originHeader =
            request.headers.get("origin") || request.headers.get("referer")
          if (originHeader) {
            try {
              origins.push(new URL(originHeader).origin)
            } catch {
              // ignore invalid URLs
            }
          }
        }
        return origins
      },
  // Only override cookie attributes in non-production so the session
  // cookie works inside the v0 integrated preview's cross-site iframe.
  // Production keeps Better Auth's defaults (SameSite=Lax, Secure, HttpOnly).
  ...(isProduction
    ? {}
    : {
        advanced: {
          defaultCookieAttributes: {
            sameSite: "none" as const,
            secure: true,
            httpOnly: true,
          },
        },
      }),
})

export type Session = typeof auth.$Infer.Session
