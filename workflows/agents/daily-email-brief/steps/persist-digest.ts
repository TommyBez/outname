import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  digestItems,
  digests,
  runs,
  type Category,
} from "@/lib/db/schema"
import { emitStep } from "@/lib/run-events"
import type { GmailMessage } from "../types"
import type { Categorized } from "./classify-and-summarize"

function nanoid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export async function persistDigest(
  runId: string,
  messages: GmailMessage[],
  classified: Categorized,
): Promise<{ digestId: string; itemCount: number }> {
  "use step"

  await emitStep("persist", "start", "Saving briefing")

  // Record how many emails were fed into this digest so the run row
  // matches what the reading loop produced (used to live in readEmails).
  await db
    .update(runs)
    .set({ emailsScanned: messages.length })
    .where(eq(runs.id, runId))

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
