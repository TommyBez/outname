import type { UIMessage, UIMessageChunk } from 'ai'

export const CHAT_STATUS_PART_ID = 'workflow-bootstrap' as const
export const CHAT_STATUS_PART_TYPE = 'data-workflow-status' as const

export const CHAT_STATUS_PHASES = [
  'workflow-session',
  'system-sandbox',
  'exec-sandbox',
  'pending-writes',
  'agent-build',
  'agent-stream',
] as const

export type ChatStatusPhase = (typeof CHAT_STATUS_PHASES)[number]

export interface WorkflowStatusData {
  message: string
  phase: ChatStatusPhase
  timestamp: string
}

export type AgentChatDataParts = Record<string, unknown> & {
  'workflow-status': WorkflowStatusData
}

export type AgentChatMessage = UIMessage<unknown, AgentChatDataParts>
export type AgentChatChunk = UIMessageChunk<unknown, AgentChatDataParts>
