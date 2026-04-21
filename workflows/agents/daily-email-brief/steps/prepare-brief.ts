import { and, desc, eq } from "drizzle-orm"
import { FatalError } from "workflow"
import { db } from "@/lib/db"
import { gmailConnection, runs } from "@/lib/db/schema"
import { emitStep } from "@/lib/run-events"

/**
 * Pre-flight for the daily brief: load the Gmail OAuth connection, compute
 * the "since" cursor from the last completed run, and assemble the
 * credentials JSON blob gws expects. Everything here is deterministic DB
 * work — no Gmail network calls, no sandbox. Splitting it out means the
 * agent's tools can stay thin and focused on driving gws commands.
 */
export async function prepareBrief(_runId: string): Promise<{
  afterEpoch: number
  sinceIso: string
  credentials: string
}> {
  "use step"

  await emitStep("read", "start", "Preparing inbox context")

  const [conn] = await db.select().from(gmailConnection).limit(1)
  if (!conn) {
    throw new FatalError(
      "Gmail is not connected. Go to /settings and click Connect Gmail.",
    )
  }
  if (conn.status !== "active") {
    throw new FatalError(
      `Gmail connection is ${conn.status}. Reconnect it in /settings.`,
    )
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new FatalError("GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is not set")
  }

  const [prev] = await db
    .select()
    .from(runs)
    .where(and(eq(runs.status, "completed")))
    .orderBy(desc(runs.completedAt))
    .limit(1)

  const since = prev?.completedAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000)
  const afterEpoch = Math.floor(since.getTime() / 1000)
  const sinceIso = since.toISOString()

  // Credentials in the "authorized_user" schema gws understands natively.
  const credentials = JSON.stringify({
    type: "authorized_user",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: conn.refreshToken,
  })

  await emitStep("read", "progress", `Since ${sinceIso}`, { afterEpoch })

  return { afterEpoch, sinceIso, credentials }
}
