import { and, desc, eq } from "drizzle-orm"
import { FatalError, RetryableError } from "workflow"
import { db } from "@/lib/db"
import { gmailConnection, runs } from "@/lib/db/schema"
import { emitStep } from "@/lib/run-events"
import { createGwsSession, normalizeGmail } from "../sandbox/gws"
import type { GmailMessage } from "../types"

export async function readEmails(runId: string): Promise<GmailMessage[]> {
  "use step"

  await emitStep("read", "start", "Connecting to Gmail")

  // 1) Load the stored Gmail connection (OAuth refresh token + client creds).
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

  // 2) Compute the "since" cursor from the last completed run.
  const [prev] = await db
    .select()
    .from(runs)
    .where(and(eq(runs.status, "completed")))
    .orderBy(desc(runs.completedAt))
    .limit(1)

  const since = prev?.completedAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000)
  const afterEpoch = Math.floor(since.getTime() / 1000)

  // 3) Credentials JSON for gws (authorized_user schema = OAuth refresh-token flow).
  const credentials = JSON.stringify({
    type: "authorized_user",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: conn.refreshToken,
  })

  let session: Awaited<ReturnType<typeof createGwsSession>> | undefined
  try {
    session = await createGwsSession({
      credentials,
      onProgress: (msg) => emitStep("read", "progress", msg),
    })

    // 4) List messages via the Discovery-generated Gmail method.
    await emitStep("read", "progress", "Listing new messages")
    const { messages: ids } = await session.listMessages({
      q: `after:${afterEpoch}`,
      maxResults: 50,
    })
    await emitStep(
      "read",
      "progress",
      `Found ${ids.length} new email${ids.length === 1 ? "" : "s"}`,
      { total: ids.length },
    )

    // 5) Fetch message metadata (serial — gws manages its own auth token internally).
    const messages: GmailMessage[] = []
    let fetched = 0
    for (const { id } of ids) {
      const msg = await session.getMessageMetadata(id)
      if (!msg) continue
      messages.push(normalizeGmail(msg))
      fetched += 1
      // Keep the stream flowing for large batches without drowning it: every
      // 5 messages, or the last one.
      if (fetched % 5 === 0 || fetched === ids.length) {
        await emitStep(
          "read",
          "progress",
          `Fetched ${fetched} of ${ids.length}`,
          { current: fetched, total: ids.length },
        )
      }
    }

    await db
      .update(runs)
      .set({ emailsScanned: messages.length })
      .where(eq(runs.id, runId))

    await emitStep(
      "read",
      "done",
      `Read ${messages.length} email${messages.length === 1 ? "" : "s"}`,
      { count: messages.length },
    )

    return messages
  } catch (err: unknown) {
    if (err instanceof FatalError || err instanceof RetryableError) {
      await emitStep("read", "error", err.message)
      throw err
    }
    const message = err instanceof Error ? err.message : String(err)
    await emitStep("read", "error", message)
    throw new RetryableError(`readEmails failed: ${message}`, {
      retryAfter: "30s",
    })
  } finally {
    if (session) {
      await session.close()
    }
  }
}
