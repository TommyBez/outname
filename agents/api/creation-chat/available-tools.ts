import { getConnector } from '@/connections/registry'
import { getAgentsForUser, getUserConnections } from '@/shared/server/data'
import { describeConfigSchema } from '@/shared/server/zod-config-fields'
import { connectorBackedCapabilities } from '@/tools/catalog/capabilities'
import { listMaintainerTools } from '@/tools/catalog/registry'

export async function listAvailableTools(userId: string) {
  const [connectionRows, agents] = await Promise.all([
    getUserConnections(userId),
    getAgentsForUser(userId),
  ])
  const connectionByConnector = new Map(
    connectionRows.map((row) => [row.connectorId, row])
  )

  return {
    maintainerTools: listMaintainerTools().map((tool) => {
      const connectors = connectorBackedCapabilities(tool.capabilities).map(
        (capability) => capability.connectorId
      )
      return {
        toolId: tool.id,
        displayName: tool.displayName,
        category: tool.category,
        description: tool.description,
        exposedTools: [...tool.resolveExposedTools()],
        configFields: describeConfigSchema(tool.configSchema),
        connectors: connectors.map((connectorId) => {
          const connector = getConnector(connectorId)
          const connection = connectionByConnector.get(connectorId)
          return {
            connectorId,
            displayName: connector?.displayName ?? connectorId,
            status: connection?.status ?? null,
          }
        }),
        toolSandboxManifest:
          tool.capabilities.find(
            (capability) => capability.kind === 'tool_sandbox'
          )?.manifest ?? null,
      }
    }),
    subAgents: agents.map((row) => ({
      agentId: row.id,
      name: row.name,
      enabled: row.enabled,
      model: row.model,
      capabilitySummary: row.capabilitySummary,
    })),
  }
}
