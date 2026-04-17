import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { sql as dsql } from "drizzle-orm"
import { db } from "@/lib/db"
import { user } from "@/lib/db/schema"

let bootstrapped = false

/**
 * Idempotently ensures the single admin user exists.
 *
 * Uses a dedicated Better Auth instance with sign-up enabled so we can
 * bypass the main instance's `disableSignUp: true` safely. This is only
 * ever called from server code (login page) and will no-op once a user
 * already exists in the database.
 */
export async function ensureAdminUser() {
  if (bootstrapped) return

  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  if (!email || !password) {
    bootstrapped = true
    return
  }

  const [{ count }] = await db
    .select({ count: dsql<number>`count(*)::int` })
    .from(user)

  if (count > 0) {
    bootstrapped = true
    return
  }

  const bootstrapAuth = betterAuth({
    database: drizzleAdapter(db, { provider: "pg" }),
    emailAndPassword: { enabled: true, disableSignUp: false },
    secret: process.env.BETTER_AUTH_SECRET,
  })

  try {
    await bootstrapAuth.api.signUpEmail({
      body: { email, password, name: "Admin" },
    })
    console.log("[v0] admin user bootstrapped:", email)
  } catch (err) {
    console.error("[v0] admin bootstrap failed:", err)
  } finally {
    bootstrapped = true
  }
}
