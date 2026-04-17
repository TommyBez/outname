import { DurableAgent } from "@workflow/ai/agent"
import { getWritable } from "workflow"
import { z } from "zod"
import type { UIMessageChunk } from "ai"
import {
  initRun,
  finalizeRun,
  readEmails,
  classifyAndSummarize,
  persistDigest,
} from "./steps"

/**
 * Daily inbox review workflow.
 *
 * Flow:
 *   1. initRun (step) — confirms the run row in Neon
 *   2. DurableAgent orchestrator runs three tools in order:
 *        readEmails → classifyAndSummarize → persistDigest
 *   3. finalizeRun (step) — marks run completed/failed
 */
export async function dailyInboxReview(runId: string) {
  "use workflow"

  // getWritable() is used so the Observability dashboard shows agent output.
  const writable = getWritable<UIMessageChunk>()

  // runtime-provided workflow run id (the runId passed to start() is our DB id)
  // DurableAgent tools reference `runId` in closure.
  await initRun(runId, runId)

  try {
    const agent = new DurableAgent({
      model: "openai/gpt-5-mini",
      system: [
        "You are a personal inbox assistant.",
        "Your job is to produce a daily digest for the user.",
        "You MUST call the tools in this exact order, once each:",
        "  1. readEmails — fetches new emails since the last run",
        "  2. classifyAndSummarize — categorizes and summarizes them",
        "  3. persistDigest — saves the digest to the database",
        "After calling persistDigest, reply with a one-sentence confirmation and stop.",
      ].join("\n"),
      tools: {
        readEmails: {
          description: "Fetch new Gmail messages since the previous completed run.",
          inputSchema: z.object({}),
          execute: async () => {
            const messages = await readEmails(runId)
            return {
              count: messages.length,
              messages,
            }
          },
        },
        classifyAndSummarize: {
          description:
            "Classify each email into urgent/reply/fyi/noise and produce a short summary for each plus an overall digest summary.",
          inputSchema: z.object({
            messages: z.array(
              z.object({
                id: z.string(),
                threadId: z.string(),
                subject: z.string(),
                from: z.string(),
                snippet: z.string(),
                receivedAt: z.string(),
              }),
            ),
          }),
          execute: async ({ messages }) => {
            const out = await classifyAndSummarize(messages)
            return out
          },
        },
        persistDigest: {
          description:
            "Persist the classified digest to the database. Pass the original messages plus the classified items and overall summary.",
          inputSchema: z.object({
            messages: z.array(
              z.object({
                id: z.string(),
                threadId: z.string(),
                subject: z.string(),
                from: z.string(),
                snippet: z.string(),
                receivedAt: z.string(),
              }),
            ),
            classified: z.object({
              items: z.array(
                z.object({
                  messageId: z.string(),
                  category: z.enum(["urgent", "reply", "fyi", "noise"]),
                  summary: z.string(),
                }),
              ),
              overallSummary: z.string(),
            }),
          }),
          execute: async ({ messages, classified }) => {
            return await persistDigest(runId, messages, classified)
          },
        },
      },
    })

    await agent.stream({
      messages: [
        {
          role: "user",
          content:
            "Run the daily inbox review now. Fetch new emails, classify them, and persist the digest.",
        },
      ],
      writable,
      maxSteps: 8,
    })

    await finalizeRun(runId, "completed")
    return { runId, status: "completed" as const }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    await finalizeRun(runId, "failed", msg)
    throw err
  }
}
