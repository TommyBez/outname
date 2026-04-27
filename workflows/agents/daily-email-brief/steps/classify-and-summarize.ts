import { Output, generateText } from "ai"
import { z } from "zod"
import { emitStep } from "@/lib/run-events"
import type { GmailMessage } from "../types"

export const CategorizedSchema = z.object({
  items: z.array(
    z.object({
      messageId: z.string(),
      category: z.enum(["urgent", "reply", "fyi", "noise"]),
      summary: z.string().max(280),
    }),
  ),
  overallSummary: z.string().max(500),
})

export type Categorized = z.infer<typeof CategorizedSchema>

export async function classifyAndSummarize(
  runId: string,
  messages: GmailMessage[],
): Promise<Categorized> {
  "use step"

  if (messages.length === 0) {
    await emitStep(runId, "classify", "done", "No new emails to classify")
    return { items: [], overallSummary: "No new emails since the last run." }
  }

  await emitStep(
    runId,
    "classify",
    "start",
    `Classifying ${messages.length} emails`,
    { count: messages.length },
  )

  const input = messages.map((m) => ({
    messageId: m.id,
    subject: m.subject,
    from: m.from,
    snippet: m.snippet,
    receivedAt: m.receivedAt,
  }))

  const { output } = await generateText({
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
    output: Output.object({ schema: CategorizedSchema }),
  })

  const counts = output.items.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + 1
    return acc
  }, {})
  await emitStep(
    runId,
    "classify",
    "done",
    `Categorized ${output.items.length} emails`,
    counts,
  )

  return output
}
