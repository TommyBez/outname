import 'server-only'
import { isConnectorBackedCapability } from '@outname/ai/tools/catalog/capabilities'
import type { MaintainerTool } from '@outname/ai/tools/catalog/types'
import { agentBrowserTool } from '@outname/ai/tools/providers/agent-browser'
import { agentBrowserLightTool } from '@outname/ai/tools/providers/agent-browser-light'
import { calcomRequestTool } from '@outname/ai/tools/providers/calcom'
import { context7DocsTool } from '@outname/ai/tools/providers/context7'
import { firecrawlScrapeTool } from '@outname/ai/tools/providers/firecrawl-scrape'
import { githubRepoTool } from '@outname/ai/tools/providers/github-repo'
import { parallelSearchTool } from '@outname/ai/tools/providers/parallel'
import { posthogRequestTool } from '@outname/ai/tools/providers/posthog'
import { resendSendTool } from '@outname/ai/tools/providers/resend'
import { supabaseRequestTool } from '@outname/ai/tools/providers/supabase'
import { typefullyRequestTool } from '@outname/ai/tools/providers/typefully'
import { v0PlatformTool } from '@outname/ai/tools/providers/v0'
import { vercelRequestTool } from '@outname/ai/tools/providers/vercel'
import {
  xApiRequestTool,
  xUserApiRequestTool,
} from '@outname/ai/tools/providers/x-api'
import { getToolSandboxManifest } from '@outname/ai/tools/sandboxes/registry'
import { getConnector } from '@outname/shared/connections/registry'
import type { Connector } from '@outname/shared/connections/types'

// Catalog order is UI order. Removing an entry is safe: existing rows degrade
// to `reason: "tool_removed"` instead of crashing boot.
const TOOLS: MaintainerTool[] = [
  resendSendTool,
  calcomRequestTool,
  context7DocsTool,
  firecrawlScrapeTool,
  githubRepoTool,
  parallelSearchTool,
  posthogRequestTool,
  agentBrowserTool,
  agentBrowserLightTool,
  xApiRequestTool,
  xUserApiRequestTool,
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
  validateMaintainerToolCapabilities(tool)
  TOOL_BY_ID.set(tool.id, tool)
}

export function validateMaintainerToolCapabilities(
  tool: MaintainerTool,
  resolveConnector: (
    connectorId: string
  ) => Connector | undefined = getConnector,
  resolveSandboxManifest: (manifest: string) => unknown = getToolSandboxManifest
): void {
  for (const capability of tool.capabilities) {
    if (isConnectorBackedCapability(capability)) {
      const connector = resolveConnector(capability.connectorId)
      if (!connector) {
        throw new Error(
          `Tool ${tool.id} references unknown connector: ${capability.connectorId}`
        )
      }
      if (
        connector.authKind === 'oauth2' &&
        capability.requiredScopes?.some(
          (scope) => !connector.oauth2.defaultScopes.includes(scope)
        )
      ) {
        throw new Error(
          `Tool ${tool.id} requires OAuth scope outside ${capability.connectorId} default scope bundle.`
        )
      }
    }
    if (capability.kind === 'tool_sandbox') {
      resolveSandboxManifest(capability.manifest)
    }
  }
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
