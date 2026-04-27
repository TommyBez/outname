import { DurableAgent } from "@workflow/ai/agent"
import { z } from "zod"
import { classifyAndSummarize } from "./steps/classify-and-summarize"
import { persistRunResult } from "@/workflows/steps/persist-result"
import { runGws } from "./sandbox/gws"

/**
 * Shape of a Gmail message once normalized by the agent from the raw
 * gws output. Declared here so the classify tool input schema can re-use
 * it and so any workflow that embeds this agent as a sub-agent tool can
 * share the same contract.
 */
const gmailMessageSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  subject: z.string(),
  from: z.string(),
  snippet: z.string(),
  receivedAt: z.string(),
})

/**
 * Runtime context required to build a bound instance of the Daily Email
 * Brief agent. The tools close over these values so they are available
 * inside each step without being passed through the LLM.
 *
 * Deliberately minimal: no cron-specific cursor fields. Cron seeds the
 * cursor via the kickoff message (see `dailyEmailBriefKickoff`), chat
 * turns supply whatever the user asked. Keeping the factory free of
 * flow-specific inputs is what lets cron and chat share the exact same
 * `DurableAgent`.
 */
export interface DailyEmailBriefAgentContext {
  /**
   * Identifier used to correlate step events for this agent invocation.
   * For cron it is the internal run id. For chat it can be the
   * conversation id, since there is no `runs` row.
   */
  runId: string
  /**
   * Owning agent row id. The `gws` tool uses this to pick the right
   * persistent sandbox on every call (one sandbox per agent row).
   */
  agentId: string
}

/**
 * Build a Daily Email Brief agent bound to a specific run or chat turn.
 *
 * The agent drives gws commands fully agentically via a single generic
 * `gws` tool — it decides what Gmail API calls to make, how to query,
 * and how to shape the results. It also authors its own markdown digest
 * and persists it via the agent-agnostic `persistResult` tool.
 *
 * The orchestrator only provides:
 *   - a live sandbox (binary staged, OAuth creds written)
 *   - a deterministic `classifyAndSummarize` helper used purely for
 *     triage reasoning
 *   - a generic `persistResult` tool that writes a single markdown
 *     document + optional metrics to `run_result`
 *
 * System prompt is capability-style (what the agent *can* do) rather
 * than script-style (a fixed sequence of steps), so the same instance
 * handles both "run the daily brief now" (cron) and "what urgent emails
 * came in today?" (chat) without branching.
 */
export function createDailyEmailBriefAgent(ctx: DailyEmailBriefAgentContext) {
  const { runId, agentId } = ctx

  return new DurableAgent({
    model: "openai/gpt-5-mini",
    system: [
      "You are a personal inbox assistant for the user's Gmail account.",
      "",
      "Tools available:",
      "- gws: execute a google-workspace-cli command in the agent's sandbox.",
      "  Returns { exitCode, stdout, stderr }. Gmail subcommands return JSON on stdout.",
      "- classifyAndSummarize: categorize a batch of emails (urgent/reply/fyi/noise) and produce summaries.",
      "- persistResult: save the run's final output as a single markdown document (+ optional metrics).",
      "",
      "When the user asks you to produce the daily brief (or is a cron kickoff),",
      "follow this flow:",
      "  1. List new Gmail messages with gws using the `after:<unix-seconds>` cursor they provide.",
      "     Example args: [\"gmail\",\"users\",\"messages\",\"list\",\"--params\",\"{\\\"userId\\\":\\\"me\\\",\\\"q\\\":\\\"after:1700000000\\\",\\\"maxResults\\\":20}\"].",
      "     Parse stdout as JSON; use the resulting `messages` array (may be empty).",
      "  2. For each message id, fetch metadata with gws using format:metadata and",
      "     metadataHeaders:[From,Subject,Date]. Assemble a GmailMessage:",
      "       - id, threadId (copy from the response)",
      "       - subject: payload.headers[] where name=Subject (case-insensitive)",
      "       - from: payload.headers[] where name=From",
      "       - snippet: top-level `snippet`",
      "       - receivedAt: ISO 8601 parsed from the Date header, falling back to",
      "         `new Date(Number(internalDate)).toISOString()`.",
      "  3. Call classifyAndSummarize with { messages } to get per-message categories and summaries.",
      "  4. Compose a markdown digest yourself using the classification result. Structure:",
      "     - Start with a short overall summary paragraph (1–3 sentences).",
      "     - Then one `## <Section>` per non-empty category in this order:",
      "       Urgent, Needs a reply, FYI, Noise.",
      "     - Under each section, one `-` list item per email formatted as:",
      "       `**<Subject>** — <Sender> — <one-sentence summary>`",
      "       Use `(no subject)` or `unknown` when a field is missing.",
      "     - If there are zero new emails, the markdown should be a single line:",
      "       `No new emails since the last run.`",
      "  5. Call `persistResult` exactly once with `{ content: <markdown>, metrics: { emailsScanned: <count> } }`.",
      "  6. Reply in one sentence confirming the brief was saved, then stop.",
      "",
      "When the user asks an ad-hoc question (chat):",
      "  - Use gws to fetch whatever Gmail data is needed.",
      "  - Do NOT call persistResult unless explicitly asked to save a digest.",
      "  - Answer concisely in natural language with the information retrieved.",
      "",
      "Rules (always):",
      "- Prefer parallel gws tool calls when fetching many message metadata.",
      "- If a gws call returns a non-zero exitCode, surface the stderr in your final reply and stop.",
      "- Never invent email content. If a header is missing, fall back to sensible defaults (\"(no subject)\", \"unknown\").",
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
          return await runGws({ agentId, args })
        },
      },
      classifyAndSummarize: {
        description:
          "Classify each email into urgent/reply/fyi/noise and produce a short summary for each plus an overall digest summary. Use the result to author the final markdown digest.",
        inputSchema: z.object({
          messages: z.array(gmailMessageSchema),
        }),
        execute: async ({ messages }) => {
          return await classifyAndSummarize(runId, messages)
        },
      },
      persistResult: {
        description:
          "Persist the final run result as a single markdown document. Call this exactly once per run, only when explicitly producing a brief; do not call it for ad-hoc chat questions.",
        inputSchema: z.object({
          content: z
            .string()
            .min(1)
            .describe("Markdown body for this run's final result."),
          metrics: z
            .record(z.unknown())
            .optional()
            .describe(
              'Optional per-run counts, e.g. { "emailsScanned": 12 }.',
            ),
        }),
        execute: async ({ content, metrics }) => {
          return await persistRunResult(runId, content, metrics)
        },
      },
    },
  })
}

/**
 * Seed user message for a cron / manual-trigger run. The concrete
 * timestamp context is baked in so the LLM doesn't have to compute it.
 */
export function dailyEmailBriefKickoff(sinceIso: string, afterEpoch: number) {
  return `Run the daily inbox review now. The previous completed run was at ${sinceIso} (Unix epoch seconds: ${afterEpoch}). List new Gmail messages after that cursor, classify them, compose a markdown digest, and call persistResult to save it.`
}
