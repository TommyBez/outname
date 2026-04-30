import type { Tool } from 'ai'
import type { z } from 'zod'
import type { RawCredential } from '@/connectors/types'

/**
 * Three-layer mapping (anchor for every maintainer tool we ship):
 *
 *   Layer            Owns                                            Storage                            Lifecycle
 *   ─────────────    ──────────────────────────────────────────────  ─────────────────────────────────  ─────────────────────────────────────────
 *   Credential       "I can talk to provider X"                      `user_connections.credentials`     One per (user, provider). Shared across
 *                                                                    (encrypted)                        all tool attachments.
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
 * Capability a maintainer tool needs at build time.
 *
 *   `connection` — needs a stored credential at the named provider,
 *                  optionally with a minimum scope set (OAuth only).
 *
 * Future Phase 4 additions (`tool_sandbox`, …) plug in here without
 * touching every existing tool.
 */
export type ToolRequirement = {
  kind: 'connection'
  provider: string
  scopes?: string[]
}

/**
 * Form descriptor for an attachment-config field. Drives the catalog UI
 * "Configure this tool" panel. Keep field shapes minimal — anything
 * fancier should land as a separate sub-form, not as flags here.
 */
export interface ToolConfigFieldDescriptor {
  name: string
  label: string
  description?: string
  type: 'text' | 'select'
  options?: { value: string; label: string }[]
  placeholder?: string
  required?: boolean
  default?: string
}

/**
 * Build context handed to `MaintainerTool.build`. Tools receive ONLY
 * what they need: validated config + decrypted credentials + a couple
 * of identifiers for logging. There is no `userId` — tools must not
 * reach around the credential layer with raw DB queries.
 */
export interface ToolBuildContext {
  /** `agent.id` of the agent owning this attachment. For logging only. */
  agentId: string
  /** Registry id, e.g. "gmail_search". For logging / error attribution. */
  toolId: string
  /** Validated attachment config — `{}` if the tool has no `configSchema`. */
  config: Record<string, unknown>
  /**
   * Decrypted, refreshed credentials keyed by provider id. The runtime
   * has already verified that every required provider is present and
   * any required scopes are granted; tools can dereference without
   * re-checking.
   */
  credentials: Record<string, RawCredential>
}

/**
 * Maintainer-shipped tool definition. The platform owns every entry in
 * `tools/registry.ts`; agents enable / configure them via
 * `agent_tools` rows but do not author them.
 */
/**
 * Unified discriminator describing why a maintainer tool is not callable
 * this turn. Consumed by:
 *
 *   - the system prompt (`composeSystemPrompt` renders a "Tools needing
 *     reconnection" block)
 *   - the catalog UI (`/agents/[agentId]/tools` shows per-row banners
 *     with the appropriate "Reconnect" / "Re-attach" / "Detach" CTA)
 *   - the connect endpoint (callers send the user here when a tool is
 *     missing scopes or credentials)
 *
 * Keep the variants small and orthogonal — every new variant is a UI
 * obligation in three places.
 */
export type Reconnect =
  | { provider: string; toolId: string; reason: 'missing_credential' }
  | { provider: string; toolId: string; reason: 'expired' }
  | { provider: string; toolId: string; reason: 'revoked' }
  | {
      provider: string
      toolId: string
      reason: 'scope_gap'
      neededScopes: string[]
    }
  | { toolId: string; reason: 'config_invalid'; message: string }
  | { toolId: string; reason: 'build_failed'; message: string }
  | { toolId: string; reason: 'tool_removed' }

export interface MaintainerTool {
  /** Stable id used in `agent_tools.tool_id` and as the AI-SDK tool key. */
  id: string
  /** Coarse category for catalog grouping. */
  category: string
  /** Human label for catalog cards. */
  displayName: string
  /** One-paragraph user-facing description. */
  description: string
  /** Capabilities the tool needs at build time. */
  requirements: ToolRequirement[]
  /** Optional Zod schema for `agent_tools.config`. */
  configSchema?: z.ZodTypeAny
  /** Optional UI metadata for the configure panel. */
  configFields?: ToolConfigFieldDescriptor[]
  /**
   * Build the AI-SDK Tool the agent actually invokes. Must throw on
   * unrecoverable misconfiguration — the runtime catches and surfaces
   * as `reason: "build_failed"`.
   */
  build(ctx: ToolBuildContext): Tool
}
