import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { eq, desc, and } from "drizzle-orm"
import { Sandbox } from "@vercel/sandbox"
import { generateText, Output } from "ai"
import { z } from "zod"
import { FatalError, RetryableError } from "workflow"
import { runs, digests, digestItems, type Category } from "@/lib/db/schema"

function getDb() {
  const sql = neon(process.env.DATABASE_URL!)
  return drizzle(sql, { schema: { runs, digests, digestItems } })
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
/* readEmails — spawn gws inside a Vercel Sandbox                              */
/* -------------------------------------------------------------------------- */

interface GmailMessage {
  id: string
  threadId: string
  subject: string
  from: string
  snippet: string
  receivedAt: string // ISO
}

export async function readEmails(runId: string): Promise<GmailMessage[]> {
  "use step"

  const db = getDb()
  // Find the previous completed run to compute the "since" cursor.
  const [prev] = await db
    .select()
    .from(runs)
    .where(and(eq(runs.status, "completed")))
    .orderBy(desc(runs.completedAt))
    .limit(1)

  const since = prev?.completedAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000)
  const afterEpoch = Math.floor(since.getTime() / 1000)

  const token = process.env.GOOGLE_WORKSPACE_CLI_TOKEN
  if (!token) throw new FatalError("GOOGLE_WORKSPACE_CLI_TOKEN not set")

  let sandbox: Sandbox | undefined
  try {
    sandbox = await Sandbox.create({
      runtime: "node22",
      timeout: 120_000,
    })

    await sandbox.runCommand({
      cmd: "npm",
      args: ["install", "-g", "@googleworkspace/cli"],
    })

    const list = await sandbox.runCommand({
      cmd: "gws",
      args: [
        "gmail",
        "messages",
        "list",
        "--query",
        `after:${afterEpoch}`,
        "--max-results",
        "50",
        "--format",
        "json",
      ],
      env: { GOOGLE_WORKSPACE_CLI_TOKEN: token },
    })

    const listStdout = await list.stdout()
    const parsed = safeParseJson<{ messages?: { id: string; threadId: string }[] }>(
      listStdout,
    )
    const ids = parsed?.messages ?? []

    const messages: GmailMessage[] = []
    for (const { id } of ids) {
      const get = await sandbox.runCommand({
        cmd: "gws",
        args: ["gmail", "messages", "get", id, "--format", "json"],
        env: { GOOGLE_WORKSPACE_CLI_TOKEN: token },
      })
      const raw = await get.stdout()
      const msg = safeParseJson<any>(raw)
      if (!msg) continue
      messages.push(normalizeGmail(msg))
    }

    // Record count on the run record.
    await db
      .update(runs)
      .set({ emailsScanned: messages.length })
      .where(eq(runs.id, runId))

    return messages
  } catch (err: any) {
    if (err instanceof FatalError) throw err
    throw new RetryableError(`readEmails failed: ${err?.message ?? err}`, {
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

function safeParseJson<T>(s: string): T | null {
  try {
    return JSON.parse(s)
  } catch {
    // gws may output lines prefixed with logs; try to isolate the JSON block.
    const first = s.indexOf("{")
    const last = s.lastIndexOf("}")
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(s.slice(first, last + 1))
      } catch {
        return null
      }
    }
    return null
  }
}

function normalizeGmail(msg: any): GmailMessage {
  const headers: { name: string; value: string }[] = msg.payload?.headers ?? []
  const header = (n: string) =>
    headers.find((h) => h.name?.toLowerCase() === n.toLowerCase())?.value ?? ""
  const dateStr = header("Date")
  const receivedAt = dateStr ? new Date(dateStr) : new Date(Number(msg.internalDate ?? Date.now()))
  return {
    id: msg.id,
    threadId: msg.threadId ?? msg.id,
    subject: header("Subject") || "(no subject)",
    from: header("From") || "unknown",
    snippet: msg.snippet ?? "",
    receivedAt: receivedAt.toISOString(),
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
