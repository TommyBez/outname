import type { UIMessage, UIMessageChunk } from 'ai'

export type SessionEvent =
  | {
      type: 'chat'
      conversationId: string
      replyToken: string
      uiMessages: UIMessage[]
    }
  | {
      type: 'heartbeat'
      ack?: string
      mode?: 'normal'
      manual?: boolean
      scheduledAt?: string
    }
  | {
      type: 'reflection'
      ack?: string
      localDate: string
      manual?: boolean
      scheduledAt?: string
    }
  | {
      type: 'invocation'
      input: string
      streamToken: string
      parentRunId?: string | null
      parentToolId?: string | null
      parentToolCallId?: string | null
      parentStream?: WritableStream<UIMessageChunk> | null
      callStack: string[]
      depth: number
    }
  | { type: 'shutdown' }

// Hook tokens are deterministic from `agentId` + session epoch. Force recovery
// advances the epoch so replacement sessions cannot share hooks with orphans.

export function sessionToken(agentId: string, sessionEpoch: number): string {
  return `agent:${agentId}:session:${sessionEpoch}`
}

export function heartbeatAckToken(
  agentId: string,
  sessionEpoch: number,
  ack: string
): string {
  return `agent:${agentId}:session:${sessionEpoch}:hb-ack:${ack}`
}
