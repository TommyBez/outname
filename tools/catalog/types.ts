import type { Tool } from 'ai'
import type { z } from 'zod'

// Keep secret bytes in connector forms, per-attachment defaults in
// `configSchema`, and per-call decisions in `inputSchema`.
export type ToolCapability =
  | { kind: 'brokered_http'; provider: string }
  | { kind: 'repo_workspace'; provider: string }
  | { kind: 'sdk'; provider: string }
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

export type BuiltMaintainerTool = Tool | Record<string, Tool>

export interface MaintainerExposedTool {
  description: string
  displayName: string
  toolId: string
}

// `build()` gets only runtime-safe attachment context. Credential reads stay in
// the broker/runtime layer or trusted server-side SDK init.
export interface ToolBuildContext {
  agentId: string
  config: Record<string, unknown>
  conversationId: string | null
  runId: string | null
  toolConfig?: Record<string, unknown>
  toolId: string
  userId: string
}

// Keep reconnect variants small: each one must be rendered by the prompt, the
// tool catalog, and the settings surfaces.
export type Reconnect =
  | { provider: string; toolId: string; reason: 'connection_unavailable' }
  | { toolId: string; reason: 'config_invalid'; message: string }
  | { toolId: string; reason: 'build_failed'; message: string }
  | { toolId: string; reason: 'tool_removed' }
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
  | { toolId: string; reason: 'sub_agent_unavailable'; message: string }
  | { toolId: string; reason: 'sub_agent_cycle' }
  | { toolId: string; reason: 'sub_agent_depth' }

export interface MaintainerTool {
  // Throw for unrecoverable misconfiguration so the runtime can surface a
  // `build_failed` reconnect instead of exposing a broken tool.
  build(ctx: ToolBuildContext): BuiltMaintainerTool
  capabilities: ToolCapability[]
  category: string
  configSchema?: z.ZodTypeAny
  description: string
  displayName: string
  exposedTools: readonly MaintainerExposedTool[]
  id: string
  resolveExposedTools(
    config?: Record<string, unknown>
  ): readonly MaintainerExposedTool[]
}
