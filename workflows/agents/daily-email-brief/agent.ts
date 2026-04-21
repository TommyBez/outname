import { DurableAgent } from "@workflow/ai/agent"
import { z } from "zod"
import { readEmails } from "./steps/read-emails"
import { classifyAndSummarize } from "./steps/classify-and-summarize"
import { persistDigest } from "./steps/persist-digest"

/**
 * Shape of a Gmail message once normalized by `readEmails`. Declared here so
 * the agent's tool input schemas can re-use it and so any workflow that
 * embeds this agent as a sub-agent tool can share the same contract.
 */
const gmailMessageSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  subject: z.string(),
  from: z.string(),
  snippet: z.string(),
  receivedAt: z.string(),
})

const classifiedSchema = z.object({
  items: z.array(
    z.object({
      messageId: z.string(),
      category: z.enum(["urgent", "reply", "fyi", "noise"]),
      summary: z.string(),
    }),
  ),
  overallSummary: z.string(),
})

/**
 * Runtime context required to build a bound instance of the Daily Email
 * Brief agent. The tools close over these values so they are available
 * inside each step without being passed through the LLM.
 */
export interface DailyEmailBriefAgentContext {
  /** Run id this agent invocation belongs to — used for event streaming. */
  runId: string
  /** Owning agent row id — used to pick the right persistent sandbox. */
  agentId: string
}

/**
 * Build a Daily Email Brief agent bound to a specific run.
 *
 * Kept as a factory (rather than a module-level singleton) so each
 * invocation gets its own tool closures over `runId` / `agentId`. The
 * returned `DurableAgent` can be:
 *   - `.stream()`-ed directly by the workflow (current use case), or
 *   - embedded as a sub-agent inside another agent's `tools` map by
 *     wrapping `agent.stream(...)` in a `tool({ execute })`.
 */
export function createDailyEmailBriefAgent(ctx: DailyEmailBriefAgentContext) {
  const { runId, agentId } = ctx

  return new DurableAgent({
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
          return { count: messages.length, messages }
        },
      },
      classifyAndSummarize: {
        description:
          "Classify each email into urgent/reply/fyi/noise and produce a short summary for each plus an overall digest summary.",
        inputSchema: z.object({
          messages: z.array(gmailMessageSchema),
        }),
        execute: async ({ messages }) => {
          return await classifyAndSummarize(messages)
        },
      },
      persistDigest: {
        description:
          "Persist the classified digest to the database. Pass the original messages plus the classified items and overall summary.",
        inputSchema: z.object({
          messages: z.array(gmailMessageSchema),
          classified: classifiedSchema,
        }),
        execute: async ({ messages, classified }) => {
          return await persistDigest(runId, messages, classified)
        },
      },
    },
  })
}

/**
 * The seed user message for a standalone run. Exposed so callers
 * embedding this agent can reuse / override it.
 */
export const DAILY_EMAIL_BRIEF_KICKOFF =
  "Run the daily inbox review now. Fetch new emails, classify them, and persist the digest."
