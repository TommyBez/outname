import { getConnector } from '@/connections/registry'
import {
  getAgentsForUser,
  getAgentTools,
  getUserConnections,
} from '@/shared/server/data'
import { describeConfigSchema } from '@/shared/server/zod-config-fields'
import { connectorBackedCapabilities } from '@/tools/catalog/capabilities'
import { listMaintainerTools } from '@/tools/catalog/registry'
import { childAgentIdFromSubAgentRow } from '@/tools/sub-agents/sub-agent-tool-name'

export type ToolVisibility = Awaited<ReturnType<typeof getAvailableAgentTools>>

export function buildEditInstructions(toolVisibility: ToolVisibility): string {
  return [
    'You are an agent editing assistant.',
    'Ask concise questions when the requested change is ambiguous. When the requested change is clear, summarize the planned edit and call the appropriate approval-gated tool.',
    'For normal configuration, call apply_agent_edit with the complete final config. For maintainer tools, call attach_maintainer_tool. For user-owned agents used as tools, call attach_sub_agent_tool. For removals, call detach_agent_tool.',
    'Before any attach or detach operation, inspect get_available_agent_tools if the current conversation does not already include the exact current tool state. Never invent tool ids, config fields, or sub-agent ids.',
    'Attach and detach operations automatically request user approval. Do not ask the user to type a magic confirmation phrase; explain the operation and let the app approval UI handle approval.',
    'If a required connector connection is missing or invalid, mention that the user may need to connect it in Settings. Attaching is still allowed if the user explicitly wants to pre-wire the tool.',
    'For per-agent budget changes (daily / weekly / monthly USD caps), first call get_agent_budget if you do not already know the current values, then call propose_agent_budget exactly once with sensible suggested defaults. The UI renders an inline editor with those values; the operator adjusts and submits, sending a follow-up message with the chosen values. Use those user-confirmed numbers to call set_agent_budget — pass `null` for any period the user wants cleared.',
    `Current tool snapshot: ${formatToolVisibilitySummary(toolVisibility)}`,
  ].join('\n')
}

export async function getAvailableAgentTools(agentId: string, userId: string) {
  const [attachedRows, connectionRows, userAgents] = await Promise.all([
    getAgentTools(agentId),
    getUserConnections(userId),
    getAgentsForUser(userId),
  ])
  const maintainerAttachedRows = attachedRows.filter(
    (row) => row.kind === 'maintainer'
  )
  const subAgentAttachedRows = attachedRows.filter(
    (row) => row.kind === 'sub_agent'
  )
  const attachedByMaintainerToolId = new Map(
    maintainerAttachedRows.map((row) => [row.toolId, row])
  )
  const connectionByConnector = new Map(
    connectionRows.map((row) => [row.connectorId, row])
  )
  const catalogToolIds = new Set(listMaintainerTools().map((item) => item.id))

  return {
    maintainerTools: listMaintainerTools().map((item) => {
      const attached = attachedByMaintainerToolId.get(item.id)
      const connectorIds = connectorBackedCapabilities(item.capabilities).map(
        (capability) => capability.connectorId
      )
      return {
        kind: 'maintainer' as const,
        toolId: item.id,
        displayName: item.displayName,
        category: item.category,
        description: item.description,
        configFields: describeConfigSchema(item.configSchema),
        toolSandboxManifest:
          item.capabilities.find(
            (capability) => capability.kind === 'tool_sandbox'
          )?.manifest ?? null,
        connectors: connectorIds.map((connectorId) => {
          const connection = connectionByConnector.get(connectorId)
          const connector = getConnector(connectorId)
          return {
            connectorId,
            displayName: connector?.displayName ?? connectorId,
            status: connection?.status ?? null,
          }
        }),
        attached: attached
          ? {
              toolId: attached.toolId,
              config: (attached.config ?? {}) as Record<string, unknown>,
              status: attached.status,
              toolSandboxError: attached.toolSandboxError,
            }
          : null,
      }
    }),
    removedMaintainerTools: removedMaintainerTools(
      maintainerAttachedRows,
      catalogToolIds
    ),
    subAgents: subAgentCandidates({
      agentId,
      subAgentAttachedRows,
      userAgents,
    }),
  }
}

function removedMaintainerTools(
  maintainerAttachedRows: Awaited<ReturnType<typeof getAgentTools>>,
  catalogToolIds: Set<string>
) {
  return maintainerAttachedRows
    .filter((row) => !catalogToolIds.has(row.toolId))
    .map((row) => ({
      kind: 'maintainer' as const,
      toolId: row.toolId,
      attached: {
        toolId: row.toolId,
        config: (row.config ?? {}) as Record<string, unknown>,
        status: row.status,
        toolSandboxError: row.toolSandboxError,
      },
    }))
}

function subAgentCandidates(input: {
  agentId: string
  subAgentAttachedRows: Awaited<ReturnType<typeof getAgentTools>>
  userAgents: Awaited<ReturnType<typeof getAgentsForUser>>
}) {
  const attachedSubAgentByChildId = new Map(
    input.subAgentAttachedRows.map((row) => [
      childAgentIdFromSubAgentRow({
        config: row.config,
        toolId: row.toolId,
      }),
      row,
    ])
  )
  return input.userAgents
    .filter((item) => item.id !== input.agentId)
    .map((item) => {
      const attached = attachedSubAgentByChildId.get(item.id)
      return {
        kind: 'sub_agent' as const,
        childAgentId: item.id,
        name: item.name,
        enabled: item.enabled,
        attached: attached !== undefined,
        toolId: attached?.toolId ?? null,
      }
    })
}

function formatToolVisibilitySummary(toolVisibility: ToolVisibility): string {
  const maintainerTools = toolVisibility.maintainerTools
    .map((item) => {
      const status = item.attached
        ? `attached:${item.attached.status}`
        : 'available'
      const connectors =
        item.connectors.length > 0
          ? item.connectors
              .map(
                (connector) =>
                  `${connector.connectorId}:${connector.status ?? 'missing'}`
              )
              .join(',')
          : 'no-connector'
      return `${item.toolId}(${status};${connectors})`
    })
    .join('; ')
  const removedTools = toolVisibility.removedMaintainerTools
    .map((item) => `${item.toolId}(attached:removed-from-catalog)`)
    .join('; ')
  const subAgents = toolVisibility.subAgents
    .map(
      (item) =>
        `${item.name}[${item.childAgentId}](${item.attached ? `attached:${item.toolId}` : 'available'})`
    )
    .join('; ')

  return [
    `maintainer tools: ${maintainerTools || 'none'}`,
    `removed attached tools: ${removedTools || 'none'}`,
    `sub-agent candidates: ${subAgents || 'none'}`,
  ].join(' | ')
}
