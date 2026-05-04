import type { Tool } from 'ai'
import type { z } from 'zod'

/**
 * Three-layer mapping (anchor for every maintainer tool we ship):
 *
 *   Layer            Owns                                            Storage                            Lifecycle
 *   ─────────────    ──────────────────────────────────────────────  ─────────────────────────────────  ─────────────────────────────────────────
 *   Credential       "I can talk to provider X"                      `user_connections.credentials`     One per (user, provider). Shared across
 *                                                                    (encrypted)                        all tool attachments. Never handed to
 *                                                                                                       tool code; brokered HTTP injects it.
 *   Attachment       "How this specific tool attachment is           `agent_tools.config` (jsonb)       One per (agent, tool). Validated against
 *   config           configured" — fromEmail, defaultCalendarId, …                                      `tool.configSchema` at attach AND at
 *                                                                                                       every event boot.
 *   Per-call args    "What to do right now"                          tool `inputSchema`                 Stateless. Agent decides per invocation.
 *
 * When in doubt: secret credential bytes → connector form; "which
 * account / channel / address to use by default" → tool configSchema;
 * runtime-decided arguments → tool inputSchema. Apply this rule when
 * adding new maintainer tools so future shapes land in the right slot
 * by default.
 */

/**
 * Capability a maintainer tool needs at build / execute time.
 *
 *   `brokered_http` — needs a stored credential at the named provider.
 *                     Authenticated calls must go through Vercel
 *                     Sandbox network-policy header injection.
 *   `tool_sandbox`  — needs a pre-built tool-sandbox snapshot for the
 *                     named manifest. The runtime spawns into the
 *                     snapshot lazily on first tool call.
 *   `none`          — no external capability. Mostly documentary; an
 *                     empty capability list is also valid.
 */
export type ToolCapability =
  | { kind: 'brokered_http'; provider: string }
  | { kind: 'tool_sandbox'; manifest: string }
  | { kind: 'none' }

export type ToolErrorCode =
  | 'invalid_input'
  | 'policy_denied'
  | 'provider_error'
  | 'rate_limited'
  | 'unavailable'
  | 'internal_error'

export type ToolResult<TData = unknown> =
  | { ok: true; data: TData }
  | { ok: false; code: ToolErrorCode; message: string }

/**
 * Build context handed to `MaintainerTool.build`. Tools receive ONLY
 * what they need to produce AI SDK tool closures. Raw credentials are
 * deliberately absent; authenticated provider calls happen through the
 * broker runtime during `execute`.
 */
export interface ToolBuildContext {
  /** `agent.id` of the agent owning this attachment. For logging only. */
  agentId: string
  /** Validated attachment config — `{}` if the tool has no `configSchema`. */
  config: Record<string, unknown>
  /** Registry id, e.g. "resend_send". For logging / error attribution. */
  toolId: string
  /** Owner of the agent; used only by shared runtime services. */
  userId: string
}

/**
 * Unified discriminator describing why a maintainer tool is not callable
 * this turn. Consumed by:
 *
 *   - the system prompt (`composeSystemPrompt` renders a "Tools needing
 *     reconnection" block)
 *   - the catalog UI (`/agents/[agentId]/tools` shows per-row banners
 *     with the appropriate "Reconnect" / "Re-attach" / "Detach" CTA)
 *   - the settings page (where users connect or replace API keys)
 *
 * Keep the variants small and orthogonal — every new variant is a UI
 * obligation in three places.
 */
export type Reconnect =
  | { provider: string; toolId: string; reason: 'connection_unavailable' }
  | { toolId: string; reason: 'config_invalid'; message: string }
  | { toolId: string; reason: 'build_failed'; message: string }
  | { toolId: string; reason: 'tool_removed' }
  // Phase 4: maintainer-tool variants when the manifest snapshot
  // isn't ready this turn.
  | {
      toolId: string
      reason: 'tool_sandbox_building'
      manifest: string
      buildId: string
    }
  | {
      toolId: string
      reason: 'tool_sandbox_unavailable'
      manifest: string
      message: string
    }
  // Phase 4: agent-as-tool (sub-agent) variants.
  | { toolId: string; reason: 'sub_agent_unavailable'; message: string }
  | { toolId: string; reason: 'sub_agent_cycle' }
  | { toolId: string; reason: 'sub_agent_depth' }

/**
 * Maintainer-shipped tool definition. The platform owns every entry in
 * `tools/registry.ts`; agents enable / configure them via
 * `agent_tools` rows but do not author them.
 */
export interface MaintainerTool {
  /**
   * Build the AI-SDK Tool the agent actually invokes. Must throw on
   * unrecoverable misconfiguration — the runtime catches and surfaces
   * as `reason: "build_failed"`.
   */
  build(ctx: ToolBuildContext): Tool
  /** Capabilities the tool needs at build / execute time. */
  capabilities: ToolCapability[]
  /** Coarse category for catalog grouping. */
  category: string
  /** Optional Zod schema for `agent_tools.config`. */
  configSchema?: z.ZodTypeAny
  /** One-paragraph user-facing description. */
  description: string
  /** Human label for catalog cards. */
  displayName: string
  /** Stable id used in `agent_tools.tool_id` and as the AI-SDK tool key. */
  id: string
}
