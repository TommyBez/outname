import type { AgentChatMessage } from '@/agent-runtime/server/chat-status'

export type AgentRunTranscriptState =
  | { kind: 'idle'; messages: AgentChatMessage[] }
  | { kind: 'connecting'; messages: AgentChatMessage[] }
  | { kind: 'streaming'; messages: AgentChatMessage[] }
  | { kind: 'unavailable'; messages: AgentChatMessage[]; message: string }
  | { kind: 'failed'; messages: AgentChatMessage[]; message: string }
