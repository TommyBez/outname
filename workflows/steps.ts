import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { eq, desc, and } from "drizzle-orm"
import { Sandbox } from "@vercel/sandbox"
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
import { emitRun, emitStep } from "@/lib/run-events"

function getDb() {
  const sql = neon(process.env.DATABASE_URL!)
  return drizzle(sql, { schema: { runs, digests, digestItems, gmailConnection } })
}

function nanoid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

// Pinned version of gws. Bump deliberately after testing.
const GWS_VERSION = "0.22.5"
// x86_64 musl-linked build — statically linked, does NOT depend on host glibc.
// Vercel Sandbox runs on x86_64; the glibc-linked GNU build from the npm
// package requires GLIBC_2.39 which the sandbox image does not provide.
const GWS_TARBALL_URL = `https://github.com/googleworkspace/cli/releases/download/v${GWS_VERSION}/google-workspace-cli-x86_64-unknown-linux-musl.tar.gz`

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
  await emitRun("started", "Run started", { runId, workflowRunId })
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
  if (status === "completed") {
    await emitStep("finalize", "done", "Briefing ready")
    await emitRun("completed", "Run complete")
  } else {
    await emitStep("finalize", "error", "Run failed", { error })
    await emitRun("failed", error ?? "Run failed")
  }
  // Note: Do NOT call closeRunEvents() here - the Workflow SDK automatically
  // closes the stream when the run completes, and calling it early causes
  // 409 "stream already completed" conflicts if steps retry or emit late.
}

/* -------------------------------------------------------------------------- */
/* readEmails — spawn gws (musl binary) inside a Vercel Sandbox                */
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

export async function readEmails(runId: string): Promise<GmailMessage[]> {
  "use step"

  await emitStep("read", "start", "Connecting to Gmail")

  const db = getDb()

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

  // 4) Download the musl tarball OUTSIDE the sandbox, then upload it in.
  //    This avoids requiring curl/wget inside the sandbox and makes the
  //    download easier to reason about.
  const tarballRes = await fetch(GWS_TARBALL_URL, { redirect: "follow" })
  if (!tarballRes.ok) {
    throw new RetryableError(
      `Failed to download gws ${GWS_VERSION}: ${tarballRes.status}`,
      { retryAfter: "30s" },
    )
  }
  const tarballBytes = Buffer.from(await tarballRes.arrayBuffer())

  let sandbox: Sandbox | undefined
  try {
    await emitStep("read", "progress", "Spinning up sandbox")
    sandbox = await Sandbox.create({
      runtime: "node22",
      timeout: 180_000,
    })

    // 5) Stage tarball + credentials inside the sandbox.
    await sandbox.writeFiles([
      { path: "/tmp/gws.tar.gz", content: tarballBytes },
      {
        path: "/tmp/gws-creds.json",
        content: Buffer.from(credentials, "utf8"),
      },
    ])

    // 6) Extract into a fresh subdirectory. The release tarball is FLAT:
    //    it contains `gws` + docs directly at the root, and the binary is
    //    already marked executable. We skip owner/permission/timestamp
    //    restoration (--no-same-owner --no-same-permissions -m) because the
    //    archive has a "." entry and tar would otherwise try to chmod/utime
    //    the target directory itself, which the sandbox user does not own.
    const extract = await sandbox.runCommand({
      cmd: "sh",
      args: [
        "-ec",
        `
mkdir -p /tmp/gws-extract
tar -xzf /tmp/gws.tar.gz -C /tmp/gws-extract --no-same-owner --no-same-permissions -m
if [ -f /tmp/gws-extract/gws ]; then
  cp /tmp/gws-extract/gws /tmp/gws
else
  echo "gws binary not found at /tmp/gws-extract/gws" >&2
  ls -la /tmp/gws-extract >&2 || true
  exit 3
fi
chmod +x /tmp/gws
/tmp/gws --version
`,
      ],
    })
    if (extract.exitCode !== 0) {
      const [stderr, stdout] = await Promise.all([extract.stderr(), extract.stdout()])
      throw new FatalError(
        `gws extract failed (exit ${extract.exitCode}). stderr: ${
          stderr.slice(0, 400) || "(empty)"
        } | stdout: ${stdout.slice(0, 400) || "(empty)"}`,
      )
    }

    const gwsEnv = {
      GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE: "/tmp/gws-creds.json",
      HOME: "/tmp",
      PATH: "/tmp:/usr/local/bin:/usr/bin:/bin",
    }

    // 7) List messages via the Discovery-generated Gmail method.
    await emitStep("read", "progress", "Listing new messages")
    const listParams = JSON.stringify({
      userId: "me",
      q: `after:${afterEpoch}`,
      maxResults: 50,
    })
    const list = await sandbox.runCommand({
      cmd: "/tmp/gws",
      args: ["gmail", "users", "messages", "list", "--params", listParams],
      env: gwsEnv,
    })

    if (list.exitCode !== 0) {
      const stderr = await list.stderr()
      await handleGwsFailure(list.exitCode, stderr)
    }

    const listStdout = await list.stdout()
    const parsed = extractJson<{
      messages?: { id: string; threadId: string }[]
    }>(listStdout)
    if (!parsed) {
      const stderr = await list.stderr()
      throw new FatalError(
        `Unable to parse gws list output. stderr: ${stderr.slice(0, 500)}`,
      )
    }
    const ids = parsed.messages ?? []
    await emitStep("read", "progress", `Found ${ids.length} new email${ids.length === 1 ? "" : "s"}`, {
      total: ids.length,
    })

    // 8) Fetch message metadata (serial — gws manages its own auth token internally).
    const messages: GmailMessage[] = []
    let fetched = 0
    for (const { id } of ids) {
      const getParams = JSON.stringify({
        userId: "me",
        id,
        format: "metadata",
        metadataHeaders: ["From", "Subject", "Date"],
      })
      const get = await sandbox.runCommand({
        cmd: "/tmp/gws",
        args: ["gmail", "users", "messages", "get", "--params", getParams],
        env: gwsEnv,
      })
      if (get.exitCode !== 0) {
        const stderr = await get.stderr()
        await handleGwsFailure(get.exitCode, stderr)
      }
      const raw = await get.stdout()
      const msg = extractJson<GmailApiMessage>(raw)
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

    await emitStep("read", "done", `Read ${messages.length} email${messages.length === 1 ? "" : "s"}`, {
      count: messages.length,
    })

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
    if (sandbox) {
      try {
        await sandbox.stop()
      } catch {
        /* ignore */
      }
    }
  }
}

async function handleGwsFailure(
  exitCode: number | null,
  stderr: string,
): Promise<never> {
  const lower = (stderr ?? "").toLowerCase()
  const isAuth =
    lower.includes("invalid_grant") ||
    lower.includes("invalid_client") ||
    lower.includes("unauthorized") ||
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("credentials") ||
    lower.includes("token has been expired or revoked") ||
    // gws structured exit code: 2 = auth error
    exitCode === 2

  if (isAuth) {
    // Mark the connection expired so the UI can prompt reconnect.
    try {
      const db = getDb()
      await db
        .update(gmailConnection)
        .set({
          status: "expired",
          lastError: stderr.slice(0, 500),
          updatedAt: new Date(),
        })
    } catch {
      /* best effort */
    }
    throw new FatalError(
      `Gmail auth failed (exit ${exitCode}). Reconnect in /settings. Details: ${stderr.slice(0, 500)}`,
    )
  }

  // Transient API failures → let the workflow retry.
  throw new RetryableError(
    `gws failed (exit ${exitCode}): ${stderr.slice(0, 500)}`,
    { retryAfter: "30s" },
  )
}

function extractJson<T>(s: string): T | null {
  // gws emits clean structured JSON on stdout. Fall back to finding the first
  // balanced `{...}` or `[...]` in case any banner text slips through.
  const trimmed = s.trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed) as T
  } catch {
    /* fall through */
  }
  const firstBrace = Math.min(
    ...[trimmed.indexOf("{"), trimmed.indexOf("[")].filter((i) => i >= 0),
  )
  if (!Number.isFinite(firstBrace)) return null
  const candidate = trimmed.slice(firstBrace)
  try {
    return JSON.parse(candidate) as T
  } catch {
    return null
  }
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
    await emitStep("classify", "done", "No new emails to classify")
    return { items: [], overallSummary: "No new emails since the last run." }
  }

  await emitStep("classify", "start", `Classifying ${messages.length} emails`, {
    count: messages.length,
  })

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

  const counts = experimental_output.items.reduce<Record<string, number>>(
    (acc, item) => {
      acc[item.category] = (acc[item.category] ?? 0) + 1
      return acc
    },
    {},
  )
  await emitStep(
    "classify",
    "done",
    `Categorized ${experimental_output.items.length} emails`,
    counts,
  )

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

  await emitStep("persist", "start", "Saving briefing")

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

  await emitStep("persist", "done", "Briefing saved", {
    itemCount: classified.items.length,
  })

  return { digestId, itemCount: classified.items.length }
}
