import type { AgentScheduleMode } from '@outname/shared/agent-schedule'

export type StepLimitMode = 'custom' | 'grind' | 'high' | 'low' | 'medium'

export interface AgentCreationSchedule {
  enabled: boolean
  intervalMinutes: number
  mode: AgentScheduleMode
  times: string[]
}

export interface AgentCreationDreaming {
  enabled: boolean
}

export interface AgentCreationStepLimit {
  custom: number | null
  mode: StepLimitMode
}

export interface AgentCreationMaintainerTool {
  config: Record<string, unknown>
  reason?: string
  toolId: string
}

export interface AgentCreationSubAgentTool {
  childAgentId: string
  reason?: string
}

export interface AgentCreationToolSet {
  maintainer: AgentCreationMaintainerTool[]
  subAgents: AgentCreationSubAgentTool[]
}

export interface AgentCreationBudget {
  /** USD per UTC day. `null` skips the cap. */
  daily: number | null
  /** USD per calendar month. `null` skips the cap. */
  monthly: number | null
  /** USD per ISO week. `null` skips the cap. */
  weekly: number | null
}

export interface AgentCreationRequest {
  behavior: string
  budget: AgentCreationBudget
  dreaming: AgentCreationDreaming
  heartbeat: AgentCreationSchedule
  identityCard?: string
  instructions?: string
  model: string
  name: string
  requestId: string
  role: string
  soul?: string
  stepLimit: AgentCreationStepLimit
  tools: AgentCreationToolSet
  userProfile?: string
}

export interface AgentCreationProposedBudget {
  daily: number | null
  monthly: number | null
  weekly: number | null
}

export interface AgentCreationProposedBudgetOutput {
  proposed: AgentCreationProposedBudget
  rationale: string
}

export interface AgentCreationAttachmentResult {
  error?: string
  kind: 'maintainer' | 'sub_agent'
  ok: boolean
  pendingBuildId?: string
  status: 'connected' | 'failed' | 'pending'
  toolId: string
}

export interface AgentCreationResult {
  agentId: string
  attachments: AgentCreationAttachmentResult[]
  created: boolean
  editUrl: string
  name: string
  overviewUrl: string
  toolsUrl: string
}
