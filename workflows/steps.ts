import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { eq, desc, and } from "drizzle-orm"
import { generateText, Output } from "ai"
import { z } from "zod"
import { FatalError, RetryableError } from "workflow"
import {
  runs,
  digests,
  digestItems,
  gmailConnection,
  type Category,
} from "@/lib/db/schema"

function getDb() {
  const sql = neon(process.env.DATABASE_URL!)
  return drizzle(sql, { schema: { runs, digests, digestItems, gmailConnection } })
}

function nanoid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/* -------------------------------------------------------------------------- */
/* initRun / finalizeRun                                                       */
/* -------------------------------------------------------------------------- */

export async function initRun(runId: string, workflowRunId: string) {
  "use step"
  const db = getDb()
  await db
    .update(runs)
    .set({ workflowRunId, status: "running" })
    .where(eq(runs.id, runId))
  return { runId, workflowRunId }
}

export async function finalizeRun(
  runId: string,
  status: "completed" | "failed",
  error?: string,
) {
  "use step"
  const db = getDb()
  await db
    .update(runs)
    .set({
      status,
      completedAt: new Date(),
      error: error ?? null,
    })
    .where(eq(runs.id, runId))
}

/* -------------------------------------------------------------------------- */
/* Gmail REST API helpers                                                      */
/* -------------------------------------------------------------------------- */

interface GmailMessage {
  id: string
  threadId: string
  subject: string
  from: string
  snippet: string
  receivedAt: string // ISO
}

interface GmailApiMessage {
  id: string
  threadId: string
  snippet?: string
  internalDate?: string
  payload?: {
    headers?: { name: string; value: string }[]
  }
}

/**
 * Exchange the stored refresh token for a fresh access token, or return the
 * cached one if it's still valid. Persists the new access token back to DB.
 *
 * Throws FatalError if the refresh token itself is invalid (user must reconnect).
 * Throws RetryableError for transient network/5xx failures.
 */
async function getValidAccessToken(): Promise<string> {
  const db = getDb()
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

  // Re-use cached access token if it expires in > 60s.
  const now = Date.now()
  if (
    conn.accessToken &&
    conn.accessTokenExpiresAt &&
    conn.accessTokenExpiresAt.getTime() - now > 60_000
  ) {
    return conn.accessToken
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new FatalError("GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is not set")
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: conn.refreshToken,
      grant_type: "refresh_token",
    }),
  })

  const bodyText = await res.text()

  if (!res.ok) {
    // Google returns 400 + { error: "invalid_grant" } when the refresh token
    // has been revoked. That's fatal — the user must reconnect.
    const isInvalidGrant =
      res.status === 400 && /invalid_grant|invalid_client/i.test(bodyText)
    const isUnauthorized = res.status === 401 || res.status === 403

    if (isInvalidGrant || isUnauthorized) {
      await db
        .update(gmailConnection)
        .set({
          status: "expired",
          lastError: bodyText.slice(0, 500),
          updatedAt: new Date(),
        })
        .where(eq(gmailConnection.id, conn.id))
      throw new FatalError(
        `Gmail authorization revoked. Reconnect in /settings. (${bodyText.slice(0, 200)})`,
      )
    }

    // 5xx or network-ish → retryable
    throw new RetryableError(
      `Token refresh failed ${res.status}: ${bodyText.slice(0, 200)}`,
      { retryAfter: "30s" },
    )
  }

  const parsed = JSON.parse(bodyText) as {
    access_token: string
    expires_in: number
  }
  const expiresAt = new Date(Date.now() + (parsed.expires_in - 30) * 1000)

  await db
    .update(gmailConnection)
    .set({
      accessToken: parsed.access_token,
      accessTokenExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(gmailConnection.id, conn.id))

  return parsed.access_token
}

/**
 * Fetch wrapper for Gmail API that maps HTTP errors to Workflow error types.
 */
async function gmailFetch<T>(url: string, accessToken: string): Promise<T> {
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
  })

  if (res.ok) {
    return (await res.json()) as T
  }

  const body = await res.text()

  // Auth failures → mark connection expired, fail fatally
  if (res.status === 401 || res.status === 403) {
    try {
      const db = getDb()
      await db
        .update(gmailConnection)
        .set({
          status: "expired",
          lastError: body.slice(0, 500),
          updatedAt: new Date(),
        })
    } catch {
      /* best effort */
    }
    throw new FatalError(
      `Gmail API auth failed (${res.status}): ${body.slice(0, 200)}`,
    )
  }

  // Rate limit / server errors → retryable
  if (res.status === 429 || res.status >= 500) {
    throw new RetryableError(`Gmail API ${res.status}: ${body.slice(0, 200)}`, {
      retryAfter: "30s",
    })
  }

  // Other 4xx → treat as fatal so we don't burn retries
  throw new FatalError(`Gmail API ${res.status}: ${body.slice(0, 200)}`)
}

/* -------------------------------------------------------------------------- */
/* readEmails — call Gmail REST API directly                                   */
/* -------------------------------------------------------------------------- */

export async function readEmails(runId: string): Promise<GmailMessage[]> {
  "use step"

  const db = getDb()
  const accessToken = await getValidAccessToken()

  // "since" cursor = completedAt of the most recent successful run,
  // falling back to the last 24h on the very first run.
  const [prev] = await db
    .select()
    .from(runs)
    .where(and(eq(runs.status, "completed")))
    .orderBy(desc(runs.completedAt))
    .limit(1)

  const since =
    prev?.completedAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000)
  const afterEpoch = Math.floor(since.getTime() / 1000)

  // List message ids matching the query
  const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(
    `after:${afterEpoch}`,
  )}&maxResults=50`
  const list = await gmailFetch<{
    messages?: { id: string; threadId: string }[]
    resultSizeEstimate?: number
  }>(listUrl, accessToken)

  const ids = list.messages ?? []

  // Fetch metadata for each (batched, limited concurrency)
  const messages: GmailMessage[] = []
  const CONCURRENCY = 5
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const batch = ids.slice(i, i + CONCURRENCY)
    const results = await Promise.all(
      batch.map(({ id }) =>
        gmailFetch<GmailApiMessage>(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          accessToken,
        ),
      ),
    )
    for (const msg of results) messages.push(normalizeGmail(msg))
  }

  await db
    .update(runs)
    .set({ emailsScanned: messages.length })
    .where(eq(runs.id, runId))

  return messages
}

function normalizeGmail(msg: GmailApiMessage): GmailMessage {
  const headers = msg.payload?.headers ?? []
  const header = (n: string) =>
    headers.find((h) => h.name?.toLowerCase() === n.toLowerCase())?.value ?? ""
  const dateStr = header("Date")
  const receivedAt = dateStr
    ? new Date(dateStr)
    : new Date(Number(msg.internalDate ?? Date.now()))
  return {
    id: msg.id,
    threadId: msg.threadId ?? msg.id,
    subject: header("Subject") || "(no subject)",
    from: header("From") || "unknown",
    snippet: msg.snippet ?? "",
    receivedAt: isNaN(receivedAt.getTime())
      ? new Date().toISOString()
      : receivedAt.toISOString(),
  }
}

/* -------------------------------------------------------------------------- */
/* classifyAndSummarize — specialist agent (generateText + Output.object)      */
/* -------------------------------------------------------------------------- */

const CategorizedSchema = z.object({
  items: z.array(
    z.object({
      messageId: z.string(),
      category: z.enum(["urgent", "reply", "fyi", "noise"]),
      summary: z.string().max(280),
    }),
  ),
  overallSummary: z.string().max(500),
})

export async function classifyAndSummarize(
  messages: GmailMessage[],
): Promise<z.infer<typeof CategorizedSchema>> {
  "use step"

  if (messages.length === 0) {
    return { items: [], overallSummary: "No new emails since the last run." }
  }

  const input = messages.map((m) => ({
    messageId: m.id,
    subject: m.subject,
    from: m.from,
    snippet: m.snippet,
    receivedAt: m.receivedAt,
  }))

  const { experimental_output } = await generateText({
    model: "openai/gpt-5-mini",
    system: [
      "You are an email triage specialist.",
      "Classify each email into exactly one category:",
      "- urgent: time-sensitive, action required soon from the user",
      "- reply: needs a personal reply but not urgent",
      "- fyi: informational, no action required",
      "- noise: newsletters, automated notifications, promotions",
      "For every email write a one-sentence summary (<= 280 chars).",
      "At the end produce a short overall digest summary (<= 500 chars).",
      "Return data matching the provided schema exactly.",
    ].join("\n"),
    prompt: `Emails to triage:\n${JSON.stringify(input, null, 2)}`,
    experimental_output: Output.object({ schema: CategorizedSchema }),
  })

  return experimental_output
}

/* -------------------------------------------------------------------------- */
/* persistDigest                                                               */
/* -------------------------------------------------------------------------- */

export async function persistDigest(
  runId: string,
  messages: GmailMessage[],
  classified: z.infer<typeof CategorizedSchema>,
): Promise<{ digestId: string; itemCount: number }> {
  "use step"

  const db = getDb()
  const digestId = nanoid()

  await db.insert(digests).values({
    id: digestId,
    runId,
    summary: classified.overallSummary,
  })

  if (classified.items.length > 0) {
    const byId = new Map(messages.map((m) => [m.id, m]))
    const rows = classified.items.map((c) => {
      const m = byId.get(c.messageId)
      return {
        id: nanoid(),
        digestId,
        messageId: c.messageId,
        threadId: m?.threadId ?? null,
        category: c.category as Category,
        subject: m?.subject ?? null,
        sender: m?.from ?? null,
        snippet: m?.snippet ?? null,
        summary: c.summary,
        receivedAt: m ? new Date(m.receivedAt) : null,
      }
    })
    await db.insert(digestItems).values(rows)
  }

  return { digestId, itemCount: classified.items.length }
}
