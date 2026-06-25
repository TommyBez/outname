import type {
  Experimental_LanguageModelStreamPart as ModelCallStreamPart,
  ToolSet,
  UIMessage,
  UIMessageChunk,
} from 'ai'

export const CHAT_STATUS_PART_TYPE = 'data-workflow-status' as const

const CHAT_STATUS_PHASES = [
  'agent-event',
  'system-sandbox',
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
export type AgentModelCallChunk = ModelCallStreamPart<ToolSet>
