import type { ProviderRequirement } from '@/connections/runtime/types'
import type { Reconnect } from '@/tools/catalog/types'

export interface PlannedTool {
  config: Record<string, unknown>
  providerRequirements: ProviderRequirement[]
  toolId: string
}

export interface PlannedSubAgent {
  childAgentId: string
  childCapabilitySummary: string | null
  childName: string
  childUserId: string
  rowToolId: string
  toolId: string
}

export interface ResolveToolPlanResult {
  planned: PlannedTool[]
  reconnects: Reconnect[]
  subAgents: PlannedSubAgent[]
}

export interface SubAgentRow {
  childAgentId: string
  rowToolId: string
}

export interface MaintainerRow {
  config: unknown
  toolId: string
}

export interface SubAgentResolution {
  reconnects: Reconnect[]
  subAgents: PlannedSubAgent[]
}

export const MAX_SUB_AGENT_DEPTH = 3
