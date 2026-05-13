import type { AgentBudgetValues } from '@/agents/components/agent-budget-widget'

export interface AgentEditChatProps {
  agentId: string
  currentBudget: AgentBudgetValues
}

export type SendMessageFn = (input: {
  text: string
}) => void | PromiseLike<void>
