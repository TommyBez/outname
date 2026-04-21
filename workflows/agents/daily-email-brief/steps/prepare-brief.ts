import { and, desc, eq } from "drizzle-orm"
import { FatalError } from "workflow"
import { db } from "@/lib/db"
import { gmailConnection, runs } from "@/lib/db/schema"
import { emitStep } from "@/lib/run-events"

/**
 * Pre-flight for the daily brief: validate the Gmail OAuth connection
 * and compute the "since" cursor from the last completed run. Everything
 * here is deterministic DB work — no Gmail network calls, no sandbox.
 *
 * Credentials are NOT returned anymore: the sandbox setup hook (see
 * `gwsSandboxSetup` in `sandbox/gws.ts`) loads them itself inside the
 * sandbox step, keeping the workflow body tool-agnostic.
 */
export async function prepareBrief(_runId: string): Promise<{
  afterEpoch: number
  sinceIso: string
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

  const [prev] = await db
    .select()
    .from(runs)
    .where(and(eq(runs.status, "completed")))
    .orderBy(desc(runs.completedAt))
    .limit(1)

  const since = prev?.completedAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000)
  const afterEpoch = Math.floor(since.getTime() / 1000)
  const sinceIso = since.toISOString()

  await emitStep("read", "progress", `Since ${sinceIso}`, { afterEpoch })

  return { afterEpoch, sinceIso }
}
