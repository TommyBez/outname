import "server-only"
import type { DurableAgent } from "@workflow/ai/agent"
import type { AgentKind } from "@/lib/db/schema"
import { createDailyEmailBriefAgent } from "@/workflows/agents/daily-email-brief/agent"

/**
 * Per-kind runtime bundle. As of Phase 1 only the `DurableAgent` factory
 * is needed — every kind now runs through the unified `agentSession`
 * workflow, which dispatches `chat` / `heartbeat` events to handlers
 * that build the kind's agent on demand.
 *
 * The legacy `cronWorkflow` field has been removed: the standalone
 * cron/manual workflow has been folded into `agentSession`'s heartbeat
 * handler. New kinds that want bespoke heartbeat behaviour (e.g. a
 * different system prompt or extra tools) only need to ship a
 * `buildAgent` factory.
 */
export interface AgentRuntime {
  /**
   * Factory that builds a `DurableAgent` bound to a specific session
   * event. The same instance handles heartbeats and chat turns — the
   * seed message decides which flow the LLM follows.
   */
  buildAgent?: (ctx: { runId: string; agentId: string }) => DurableAgent
}

export const AGENT_RUNTIMES: Partial<Record<AgentKind, AgentRuntime>> = {
  "daily-email-brief": {
    buildAgent: (ctx) => createDailyEmailBriefAgent(ctx),
  },
}

export function getAgentRuntime(kind: AgentKind): AgentRuntime | undefined {
  return AGENT_RUNTIMES[kind]
}
