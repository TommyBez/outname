import type { SandboxSetup } from "@/lib/agent-sandbox"
import type { AgentKind } from "@/lib/db/schema"
import { gwsSandboxSetup } from "@/workflows/agents/daily-email-brief/sandbox/gws"

/**
 * Per-agent-kind sandbox configuration. Looked up at runtime by
 * `startupAgentSandbox` via a lazy import — this file is runtime-only
 * and should never end up in a client/Server-Component bundle.
 *
 * Kinds without an entry here simply get a plain empty persistent
 * sandbox on startup, which is fine for agents that never need to
 * install binaries or write per-run state to the sandbox filesystem.
 */
export const SANDBOX_SETUPS: Partial<Record<AgentKind, SandboxSetup>> = {
  "daily-email-brief": gwsSandboxSetup,
}
