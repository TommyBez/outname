import { DurableAgent } from "@workflow/ai/agent"
import { getWritable, sleep } from "workflow"
import { z } from "zod"
import type { UIMessageChunk } from "ai"
import { initRun } from "./steps/init-run"
import { finalizeRun } from "./steps/finalize-run"
import { readEmails } from "./steps/read-emails"
import { classifyAndSummarize } from "./steps/classify-and-summarize"
import { persistDigest } from "./steps/persist-digest"

/**
 * Daily email brief agent workflow.
 *
 * Flow:
 *   0. (optional) sleep until `scheduledForMs` — set by the cron runner so
 *      the workflow fires at the user's local scheduled time
 *   1. initRun (step) — emits the "started" event
 *   2. DurableAgent orchestrator runs three tools in order:
 *        readEmails → classifyAndSummarize → persistDigest
 *   3. finalizeRun (step) — marks run completed/failed
 */
export async function dailyEmailBrief(input: {
  runId: string
  agentId: string
  scheduledForMs?: number
}) {
  "use workflow"

  const { runId, agentId, scheduledForMs } = input

  // Cron triggers pass a future `scheduledForMs`; manual triggers do not.
  if (scheduledForMs && scheduledForMs > Date.now()) {
    await sleep(new Date(scheduledForMs))
  }

  // getWritable() is used so the Observability dashboard shows agent output.
  const writable = getWritable<UIMessageChunk>()

  // The trigger route sets workflowRunId on the DB row after start() returns;
  // initRun just emits the "started" event for streaming clients.
  await initRun(runId)

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
          description:
            "Fetch new Gmail messages since the previous completed run.",
          inputSchema: z.object({}),
          execute: async () => {
            const messages = await readEmails(runId, agentId)
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
