import type { ToolPart } from '@outname/ai/components/ai-elements/tool'
import type {
  AgentCreationProposedBudgetOutput,
  AgentCreationRequest,
  AgentCreationResult,
} from '@outname/shared/agents/server/creation-types'
import type { UIMessage } from 'ai'

export type AgentCreationMessage = UIMessage
export type SendMessageFn = (input: {
  text: string
}) => void | PromiseLike<void>

export interface CreateAgentToolPart {
  approval?: {
    approved?: boolean
    id: string
    reason?: string
  }
  errorText?: string
  input: AgentCreationRequest | undefined
  output?: AgentCreationResult
  state: ToolPart['state']
  toolCallId: string
  type: 'tool-create_requested_agent'
}

export interface ProposeBudgetToolPart {
  errorText?: string
  input:
    | {
        daily: number | null
        weekly: number | null
        monthly: number | null
        rationale?: string
      }
    | undefined
  output?: AgentCreationProposedBudgetOutput
  state: ToolPart['state']
  toolCallId: string
  type: 'tool-propose_agent_budget'
}

export type ToolApprovalResponder = (input: {
  approved: boolean
  id: string
  reason?: string
}) => void | PromiseLike<void>
