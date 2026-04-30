import 'server-only'
import { calendarCreateTool, calendarReadTool } from './google-calendar'
import { gmailSearchTool, gmailSendTool } from './gmail'
import { resendSendTool } from './resend'
import type { MaintainerTool } from './types'

/**
 * Maintainer-shipped tool catalog. Order is the order the catalog UI
 * renders cards in. Add a tool here and it shows up automatically;
 * remove one and existing `agent_tools` rows referencing it surface as
 * `reason: "tool_removed"` in the reconnects channel (no crash).
 *
 * `web.fetch` is intentionally absent for Phase 3 — the agent reaches
 * the open web via `bash + curl` in the exec sandbox until SSRF guards
 * are designed (architecture §7 footnote).
 */
const TOOLS: MaintainerTool[] = [
  gmailSearchTool,
  gmailSendTool,
  calendarReadTool,
  calendarCreateTool,
  resendSendTool,
]

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
export const TOOL_CATEGORY_ORDER = ['gmail', 'calendar', 'email'] as const
