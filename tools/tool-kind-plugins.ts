import 'server-only'
import type { AgentTool, AgentToolKind } from '@/lib/db/schema'
import { AGENT_TOOL_PREFIX } from './agent-tool-prefix'

export type ToolKindResolvedRow =
  | { kind: 'maintainer'; config: unknown; toolId: string }
  | { kind: 'sub_agent'; childAgentId: string; toolId: string }

export interface ToolKindPlugin {
  kind: AgentToolKind
  label: string
  resolveRow(row: AgentTool): ToolKindResolvedRow
}

function childAgentIdForToolId(toolId: string): string {
  return toolId.startsWith(AGENT_TOOL_PREFIX)
    ? toolId.slice(AGENT_TOOL_PREFIX.length)
    : toolId
}

const TOOL_KIND_PLUGINS: ToolKindPlugin[] = [
  {
    kind: 'maintainer',
    label: 'Maintainer catalog tool',
    resolveRow(row) {
      return { kind: 'maintainer', toolId: row.toolId, config: row.config }
    },
  },
  {
    kind: 'sub_agent',
    label: 'Sub-agent tool',
    resolveRow(row) {
      return {
        kind: 'sub_agent',
        toolId: row.toolId,
        childAgentId: childAgentIdForToolId(row.toolId),
      }
    },
  },
]

const TOOL_KIND_BY_ID = new Map<string, ToolKindPlugin>()

for (const plugin of TOOL_KIND_PLUGINS) {
  if (TOOL_KIND_BY_ID.has(plugin.kind)) {
    throw new Error(`Duplicate tool kind plugin: ${plugin.kind}`)
  }
  TOOL_KIND_BY_ID.set(plugin.kind, plugin)
}

export function getToolKindPlugin(kind: string): ToolKindPlugin | undefined {
  return TOOL_KIND_BY_ID.get(kind)
}

export function listToolKindPlugins(): readonly ToolKindPlugin[] {
  return TOOL_KIND_PLUGINS
}

export function resolveToolKindRows(rows: AgentTool[]): ToolKindResolvedRow[] {
  const resolved: ToolKindResolvedRow[] = []
  for (const row of rows) {
    const plugin = getToolKindPlugin(row.kind)
    if (plugin) {
      resolved.push(plugin.resolveRow(row))
    }
  }
  return resolved
}
