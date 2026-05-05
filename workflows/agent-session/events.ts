import type { UIMessage, UIMessageChunk } from 'ai'

/**
 * Session event union for `agentSessionWorkflow`.
 *
 * - `chat` — user turn; `replyToken` namespaces streamed chunks for the route.
 * - `heartbeat` — ticker or manual trigger; optional `ack` so the ticker knows the run finished.
 * - `reflection` — ticker or manual reflection pass; same ack contract.
 * - `invocation` — a parent agent's `agent_<child>` tool call.
 *   Carries the parent's free-text instruction, the child stream token
 *   used for the invocation transcript, and the call-stack/depth that
 *   resolveToolPlan and the runtime use to refuse cycles or excessive
 *   nesting.
 * - `shutdown` — agent disabled/deleted; loop exits and the ticker is torn down.
 */
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

// Hook tokens — deterministic from `agentId` only.

/** Main session event hook — one per agent. */
export function sessionToken(agentId: string): string {
  return `agent:${agentId}:session`
}

/**
 * Per-tick ack hook. The session resumes this with `{ done: true }`
 * once the heartbeat handler returns, releasing the ticker to sleep
 * for the next interval.
 */
export function heartbeatAckToken(agentId: string, ack: string): string {
  return `agent:${agentId}:hb-ack:${ack}`
}
