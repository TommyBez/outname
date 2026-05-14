import 'server-only'
import { getConnector } from '@/connections/registry'
import type { MaintainerTool } from '@/tools/catalog/types'
import { agentBrowserTool } from '@/tools/providers/agent-browser'
import { agentBrowserLightTool } from '@/tools/providers/agent-browser-light'
import { calcomRequestTool } from '@/tools/providers/calcom'
import { firecrawlScrapeTool } from '@/tools/providers/firecrawl-scrape'
import { githubRepoTool } from '@/tools/providers/github-repo'
import { parallelSearchTool } from '@/tools/providers/parallel'
import { posthogRequestTool } from '@/tools/providers/posthog'
import { resendSendTool } from '@/tools/providers/resend'
import { supabaseRequestTool } from '@/tools/providers/supabase'
import { typefullyRequestTool } from '@/tools/providers/typefully'
import { v0PlatformTool } from '@/tools/providers/v0'
import { vercelRequestTool } from '@/tools/providers/vercel'
import { xApiRequestTool } from '@/tools/providers/x-api'
import { getToolSandboxManifest } from '@/tools/sandboxes/registry'

// Catalog order is UI order. Removing an entry is safe: existing rows degrade
// to `reason: "tool_removed"` instead of crashing boot.
const TOOLS: MaintainerTool[] = [
  resendSendTool,
  calcomRequestTool,
  firecrawlScrapeTool,
  githubRepoTool,
  parallelSearchTool,
  posthogRequestTool,
  agentBrowserTool,
  agentBrowserLightTool,
  xApiRequestTool,
  typefullyRequestTool,
  vercelRequestTool,
  supabaseRequestTool,
  v0PlatformTool,
]
const TOOL_BY_ID = new Map<string, MaintainerTool>()

for (const tool of TOOLS) {
  if (TOOL_BY_ID.has(tool.id)) {
    throw new Error(`Duplicate maintainer tool id: ${tool.id}`)
  }
  for (const capability of tool.capabilities) {
    if (
      (capability.kind === 'brokered_http' || capability.kind === 'sdk') &&
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

// Categories not listed here fall to the end alphabetically in the catalog UI.
export const TOOL_CATEGORY_ORDER = [
  'email',
  'scheduling',
  'analytics',
  'social',
  'browser',
  'developer',
  'deployment',
  'database',
] as const
