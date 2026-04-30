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
 *   `connection`    — needs a stored credential at the named provider.
 *   `tool_sandbox`  — needs a pre-built tool-sandbox snapshot for the
 *                     named manifest (Phase 4). The runtime spawns
 *                     into the snapshot lazily on first tool call.
 */
export type ToolRequirement =
  | { kind: 'connection'; provider: string }
  | { kind: 'tool_sandbox'; manifest: string }

/**
 * Form descriptor for an attachment-config field. Drives the catalog UI
 * "Configure this tool" panel. Keep field shapes minimal — anything
 * fancier should land as a separate sub-form, not as flags here.
 */
export interface ToolConfigFieldDescriptor {
  default?: string
  description?: string
  label: string
  name: string
  options?: { value: string; label: string }[]
  placeholder?: string
  required?: boolean
  type: 'text' | 'select'
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
  /** Validated attachment config — `{}` if the tool has no `configSchema`. */
  config: Record<string, unknown>
  /**
   * Decrypted, refreshed credentials keyed by provider id. The runtime
   * has already verified that every required provider is present; tools
   * can dereference without re-checking.
   */
  credentials: Record<string, RawCredential>
  /** Registry id, e.g. "resend_send". For logging / error attribution. */
  toolId: string
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

export interface MaintainerTool {
  /**
   * Build the AI-SDK Tool the agent actually invokes. Must throw on
   * unrecoverable misconfiguration — the runtime catches and surfaces
   * as `reason: "build_failed"`.
   */
  build(ctx: ToolBuildContext): Tool
  /** Coarse category for catalog grouping. */
  category: string
  /** Optional UI metadata for the configure panel. */
  configFields?: ToolConfigFieldDescriptor[]
  /** Optional Zod schema for `agent_tools.config`. */
  configSchema?: z.ZodTypeAny
  /** One-paragraph user-facing description. */
  description: string
  /** Human label for catalog cards. */
  displayName: string
  /** Stable id used in `agent_tools.tool_id` and as the AI-SDK tool key. */
  id: string
  /** Capabilities the tool needs at build time. */
  requirements: ToolRequirement[]
}
