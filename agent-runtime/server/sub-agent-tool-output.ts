import type { AgentChatMessage } from '@/agent-runtime/server/chat-status'

export interface SubAgentToolOutput {
  childAgentId: string
  childName: string
  error?: string
  finalText?: string
  kind: 'sub_agent'
  messages: AgentChatMessage[]
  status: 'running' | 'completed' | 'failed'
  toolName: string
}

export function isSubAgentToolOutput(
  value: unknown
): value is SubAgentToolOutput {
  if (!(typeof value === 'object' && value !== null)) {
    return false
  }
  const output = value as Partial<SubAgentToolOutput>
  return (
    output.kind === 'sub_agent' &&
    typeof output.childAgentId === 'string' &&
    typeof output.childName === 'string' &&
    typeof output.toolName === 'string' &&
    typeof output.status === 'string' &&
    Array.isArray(output.messages)
  )
}

export function subAgentModelText(output: SubAgentToolOutput): string {
  if (output.status === 'failed') {
    return `Sub-agent "${output.childName}" failed: ${
      output.error ?? 'Unknown error'
    }`
  }
  return output.finalText?.trim() || `Sub-agent "${output.childName}" finished.`
}
