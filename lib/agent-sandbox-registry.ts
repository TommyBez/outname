/**
 * Per-role sandbox configuration. Phase 2 splits each agent's persistent
 * Vercel Sandbox into two roles:
 *
 *   - "system" — holds the agent's memory volume: AGENTS.md, SOUL.md,
 *     and the rest of the memory `*.md` files. Read on every event by
 *     `composeSystemPrompt`; written by the memory tool's pending-writes
 *     queue at end-of-event. Booted with a small fixed timeout because
 *     it never runs heavy work.
 *
 *   - "exec" — a clean `/workspace` the agent can shell into via the
 *     bash / file-edit tools. Sized larger because the agent may build,
 *     compile, or run scripts here. Workspace persists across events
 *     (snapshot-on-stop) so a heartbeat can pick up where chat left off.
 *
 * The configs are intentionally static — boot parameters only. Anything
 * dynamic (AGENTS.md seeding, /workspace bootstrap) lives in
 * `lib/agent-sandbox.ts`'s startup helpers.
 */

import type { CreateOptions } from "@/lib/agent-sandbox-types"

export interface SandboxConfig {
  /**
   * Forwarded to `Sandbox.create` on first boot. Subsequent boots
   * resume by id and inherit whatever the snapshot already contains.
   */
  createOptions?: CreateOptions
}

export const SYSTEM_SANDBOX_CONFIG: SandboxConfig = {
  createOptions: {
    runtime: "node22",
    // Memory ops are tiny — read/write a handful of small markdown
    // files. 60s is plenty of headroom for the longest realistic
    // composeSystemPrompt + flush cycle.
    timeout: 60_000,
    resources: { vcpus: 1 },
  },
}

export const EXEC_SANDBOX_CONFIG: SandboxConfig = {
  createOptions: {
    runtime: "node22",
    // Generous default for the exec sandbox: agents may install
    // dependencies, run linters, or hit network APIs from inside it.
    timeout: 300_000,
    resources: { vcpus: 2 },
  },
}

export type SandboxRole = "system" | "exec"

export const SANDBOX_CONFIGS: Record<SandboxRole, SandboxConfig> = {
  system: SYSTEM_SANDBOX_CONFIG,
  exec: EXEC_SANDBOX_CONFIG,
}

/**
 * Persistent sandbox root inside the system sandbox. AGENTS.md, SOUL.md,
 * and every memory file the agent writes via the `memory_*` tools live
 * directly under this prefix (e.g. `/vercel/sandbox/journal.md`).
 *
 * This matches Phase 1's layout so the existing `agent_files` flush in
 * `endOfEvent` keeps working unchanged when pointed at the system
 * sandbox.
 */
export const SYSTEM_SANDBOX_ROOT = "/vercel/sandbox"

/**
 * Working directory inside the exec sandbox. Created by the exec
 * sandbox's setup hook on first boot.
 */
export const EXEC_SANDBOX_WORKSPACE = "/vercel/sandbox/workspace"
