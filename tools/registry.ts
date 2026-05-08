import 'server-only'
import { getConnector } from '@/connectors/registry'
import { agentBrowserTool } from './agent-browser'
import { calcomRequestTool } from './calcom'
import { parallelSearchTool } from './parallel'
import { posthogRequestTool } from './posthog'
import { resendSendTool } from './resend'
import { getToolSandboxManifest } from './sandboxes/registry'
import { typefullyRequestTool } from './typefully'
import type { MaintainerTool } from './types'
import { vercelRequestTool } from './vercel'
import { xApiRequestTool } from './x-api'

/**
 * Maintainer-shipped tool catalog. Order is the order the catalog UI
 * renders cards in. Add a tool here and it shows up automatically;
 * remove one and existing `agent_tools` rows referencing it surface as
 * `reason: "tool_removed"` in the reconnects channel (no crash).
 *
 * Phase 3 intentionally ships only API-key or no-auth catalog tools.
 * OAuth-backed tools are deferred until the connector flow is worth the
 * extra product and security surface. Phase 4 adds tool-sandbox-backed
 * tools (e.g. `agent_browser`) — those declare a `tool_sandbox`
 * capability instead of (or in addition to) `brokered_http`.
 */
const TOOLS: MaintainerTool[] = [
  resendSendTool,
  calcomRequestTool,
  parallelSearchTool,
  posthogRequestTool,
  agentBrowserTool,
  xApiRequestTool,
  typefullyRequestTool,
  vercelRequestTool,
]
const TOOL_BY_ID = new Map<string, MaintainerTool>()

for (const tool of TOOLS) {
  if (TOOL_BY_ID.has(tool.id)) {
    throw new Error(`Duplicate maintainer tool id: ${tool.id}`)
  }
  for (const capability of tool.capabilities) {
    if (
      capability.kind === 'brokered_http' &&
      !getConnector(capability.provider)
    ) {
      throw new Error(
        `Tool ${tool.id} references unknown provider: ${capability.provider}`
      )
    }
    if (capability.kind === 'tool_sandbox') {
      getToolSandboxManifest(capability.manifest)
    }
  }
  TOOL_BY_ID.set(tool.id, tool)
}

export function listMaintainerTools(): readonly MaintainerTool[] {
  return TOOLS
}

export function getMaintainerTool(toolId: string): MaintainerTool | undefined {
  return TOOL_BY_ID.get(toolId)
}

/**
 * Coarse category ordering for the catalog UI. Tools with categories
 * not in this list fall to the end alphabetically.
 */
export const TOOL_CATEGORY_ORDER = [
  'email',
  'scheduling',
  'analytics',
  'social',
  'browser',
  'deployment',
] as const
