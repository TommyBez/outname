import 'server-only'
import { resendSendTool } from './resend'
import type { MaintainerTool } from './types'

/**
 * Maintainer-shipped tool catalog. Order is the order the catalog UI
 * renders cards in. Add a tool here and it shows up automatically;
 * remove one and existing `agent_tools` rows referencing it surface as
 * `reason: "tool_removed"` in the reconnects channel (no crash).
 *
 * Phase 3 intentionally ships only API-key or no-auth catalog tools.
 * OAuth-backed tools are deferred until the connector flow is worth the
 * extra product and security surface.
 */
const TOOLS: MaintainerTool[] = [resendSendTool]

export function listMaintainerTools(): readonly MaintainerTool[] {
  return TOOLS
}

export function getMaintainerTool(toolId: string): MaintainerTool | undefined {
  return TOOLS.find((t) => t.id === toolId)
}

/**
 * Coarse category ordering for the catalog UI. Tools with categories
 * not in this list fall to the end alphabetically.
 */
export const TOOL_CATEGORY_ORDER = ['email'] as const
