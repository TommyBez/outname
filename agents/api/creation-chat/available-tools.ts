import { getConnector } from '@/connections/registry'
import { getAgentsForUser, getUserConnections } from '@/shared/server/data'
import { describeConfigSchema } from '@/shared/server/zod-config-fields'
import { providerBackedCapabilities } from '@/tools/catalog/capabilities'
import { listMaintainerTools } from '@/tools/catalog/registry'

export async function listAvailableTools(userId: string) {
  const [connectionRows, agents] = await Promise.all([
    getUserConnections(userId),
    getAgentsForUser(userId),
  ])
  const connectionByProvider = new Map(
    connectionRows.map((row) => [row.provider, row])
  )

  return {
    maintainerTools: listMaintainerTools().map((tool) => {
      const providers = providerBackedCapabilities(tool.capabilities).map(
        (capability) => capability.provider
      )
      return {
        toolId: tool.id,
        displayName: tool.displayName,
        category: tool.category,
        description: tool.description,
        exposedTools: [...tool.resolveExposedTools()],
        configFields: describeConfigSchema(tool.configSchema),
        providers: providers.map((provider) => {
          const connector = getConnector(provider)
          const connection = connectionByProvider.get(provider)
          return {
            provider,
            displayName: connector?.displayName ?? provider,
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
