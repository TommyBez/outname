import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { db } from "@/lib/db"

// Static origins we always want to trust in addition to BETTER_AUTH_URL.
// - localhost: local dev
// - *.vercel.app: Vercel preview/production deployments
// - *.vercel.run: Vercel sandbox URLs (used by the v0 integrated preview)
// - *.v0.app / *.v0.dev: v0 preview URLs
// - *.vusercontent.net: v0 iframe sandbox hosts
const staticTrustedOrigins = [
  "http://localhost:3000",
  "https://*.vercel.app",
  "https://*.vercel.run",
  "https://*.v0.app",
  "https://*.v0.dev",
  "https://*.vusercontent.net",
]

// The v0 integrated preview embeds the app in a cross-site iframe, which
// means the session cookie must be SameSite=None; Secure; Partitioned for
// browsers to accept and send it back.
const isProduction = process.env.NODE_ENV === "production"

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
  // Use the function form so we can trust the incoming origin in
  // non-production environments (e.g. the v0 integrated preview sandbox,
  // whose host is dynamic and not known ahead of time). In production we
  // fall back to the static list + BETTER_AUTH_URL only.
  trustedOrigins: async (request) => {
    const origins = [
      ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
      ...staticTrustedOrigins,
    ]

    if (!isProduction) {
      const originHeader = request.headers.get("origin") || request.headers.get("referer")
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
  advanced: {
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
      partitioned: isProduction,
      httpOnly: true,
    },
  },
})

export type Session = typeof auth.$Infer.Session
