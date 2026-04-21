import { DurableAgent } from "@workflow/ai/agent"
import { z } from "zod"
import { classifyAndSummarize } from "./steps/classify-and-summarize"
import { persistDigest } from "./steps/persist-digest"
import type { GwsSession } from "./sandbox/gws"

/**
 * Shape of a Gmail message once normalized by the agent from the raw
 * gws output. Declared here so the classify / persist tool input schemas
 * can re-use it and so any workflow that embeds this agent as a sub-agent
 * tool can share the same contract.
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
  /**
   * A live GwsSession. The workflow opens this before streaming the agent
   * and closes it in a finally block afterwards. Every `gws` tool call is
   * executed inside this sandbox.
   */
  session: GwsSession
  /** Unix epoch seconds of the last completed run — the `after:` cursor. */
  afterEpoch: number
  /** ISO timestamp of the last completed run — human-readable for the LLM. */
  sinceIso: string
}

/**
 * Build a Daily Email Brief agent bound to a specific run.
 *
 * The agent drives gws commands fully agentically via a single generic
 * `gws` tool — it decides what Gmail API calls to make, how to query, and
 * how to shape the results. The orchestrator only provides:
 *   - a live sandbox session (binary staged, OAuth creds written)
 *   - the `after:` cursor for "new since last run"
 *   - deterministic tools for the non-Gmail parts (classify, persist)
 */
export function createDailyEmailBriefAgent(ctx: DailyEmailBriefAgentContext) {
  const { runId, session, afterEpoch } = ctx

  return new DurableAgent({
    model: "openai/gpt-5-mini",
    system: [
      "You are a personal inbox assistant producing a daily Gmail digest.",
      "",
      "You have three tools:",
      "- gws: execute a google-workspace-cli command inside the agent's sandbox. Returns { exitCode, stdout, stderr }. Exit 0 = success; stdout is JSON for Gmail commands.",
      "- classifyAndSummarize: categorize a batch of emails (urgent/reply/fyi/noise) and produce summaries.",
      "- persistDigest: save the final digest to the database.",
      "",
      "Expected flow:",
      `1. List new Gmail messages. Call gws with args: ["gmail","users","messages","list","--params","{\\"userId\\":\\"me\\",\\"q\\":\\"after:${afterEpoch}\\",\\"maxResults\\":20}"]. Parse stdout as JSON; use the resulting \`messages\` array of { id, threadId } (may be empty).`,
      "2. For each message id, fetch metadata. Call gws with args: [\"gmail\",\"users\",\"messages\",\"get\",\"--params\", JSON.stringify({userId:\"me\", id, format:\"metadata\", metadataHeaders:[\"From\",\"Subject\",\"Date\"]})]. Parse stdout as JSON and assemble a GmailMessage:",
      "   - id, threadId (copy from the response)",
      "   - subject: payload.headers[] where name=Subject (case-insensitive)",
      "   - from: payload.headers[] where name=From",
      "   - snippet: top-level `snippet`",
      "   - receivedAt: ISO 8601 string parsed from the Date header, falling back to `new Date(Number(internalDate)).toISOString()`",
      "3. Call classifyAndSummarize with { messages: GmailMessage[] }.",
      "4. Call persistDigest with { messages, classified }.",
      "5. Reply with a one-sentence confirmation that includes the counts, then stop.",
      "",
      "Rules:",
      "- Prefer parallel gws tool calls when fetching many message metadata.",
      "- If the list call returns zero messages, still call classifyAndSummarize and persistDigest with empty arrays so the run completes cleanly.",
      "- If a gws call returns a non-zero exitCode, surface the stderr in your final reply and stop.",
      "- Never invent email content. If a header is missing, fall back to sensible defaults (e.g. \"(no subject)\", \"unknown\").",
    ].join("\n"),
    tools: {
      gws: {
        description:
          "Run a google-workspace-cli command inside the agent's persistent sandbox. Authentication is already configured on the filesystem. Returns the command's exit code plus raw stdout/stderr strings.",
        inputSchema: z.object({
          args: z
            .array(z.string())
            .describe(
              'Argv for gws. Example: ["gmail","users","messages","list","--params","{\\"userId\\":\\"me\\",\\"q\\":\\"after:1700000000\\"}"]',
            ),
        }),
        execute: async ({ args }) => {
          "use step"
          return await session.run({ args })
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
 * Seed user message for a standalone run. Exposed as a factory so callers
 * embedding this agent can reuse / override it. The concrete timestamp
 * context is baked in so the LLM doesn't have to compute it.
 */
export function dailyEmailBriefKickoff(sinceIso: string, afterEpoch: number) {
  return `Run the daily inbox review now. The previous completed run was at ${sinceIso} (Unix epoch seconds: ${afterEpoch}). List new Gmail messages after that cursor, classify them, and persist the digest.`
}
