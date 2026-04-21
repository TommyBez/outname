import "server-only"
import type { DurableAgent } from "@workflow/ai/agent"
import type { AgentKind } from "@/lib/db/schema"
import { dailyEmailBrief } from "@/workflows/agents/daily-email-brief/workflow"
import { createDailyEmailBriefAgent } from "@/workflows/agents/daily-email-brief/agent"

/**
 * Per-kind runtime bundle: the cron/manual workflow entry point plus the
 * `DurableAgent` factory used by the generic chat workflow.
 *
 * This registry is the single place that dispatches `agent.kind` to its
 * workflow + agent. Both `lib/start-agent-run.ts` (cron / manual trigger)
 * and `lib/start-agent-chat.ts` (chat) read from here, so adding a new
 * kind is one entry — mirroring how `lib/agent-sandbox-registry.ts`
 * centralizes kind → sandbox setup.
 *
 * Loose-coupling guarantees (deliberate):
 * - `cronWorkflow` is optional. A kind can expose only chat.
 * - `buildAgent` is optional. A kind can expose only cron.
 * - Sandbox needs are still declared independently in
 *   `agent-sandbox-registry.ts`; this registry knows nothing about them.
 */
export interface AgentRuntime {
  /**
   * Cron / manual-trigger workflow for this kind. Omit for chat-only kinds.
   * Typed `any` at the signature level because every kind accepts a
   * different input shape; `start-agent-run.ts` owns that dispatch.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cronWorkflow?: (...args: any[]) => any
  /**
   * Factory that builds a `DurableAgent` bound to a specific invocation.
   * The same instance handles cron kickoffs and chat turns — the seed
   * message decides which flow the LLM follows.
   */
  buildAgent?: (ctx: { runId: string; agentId: string }) => DurableAgent
}

export const AGENT_RUNTIMES: Partial<Record<AgentKind, AgentRuntime>> = {
  "daily-email-brief": {
    cronWorkflow: dailyEmailBrief,
    buildAgent: (ctx) => createDailyEmailBriefAgent(ctx),
  },
}

export function getAgentRuntime(kind: AgentKind): AgentRuntime | undefined {
  return AGENT_RUNTIMES[kind]
}
