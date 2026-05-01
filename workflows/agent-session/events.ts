import type { UIMessage } from 'ai'

/**
 * Session event union for `agentSessionWorkflow`.
 *
 * - `chat` — user turn; `replyToken` namespaces streamed chunks for the route.
 * - `heartbeat` — ticker or manual trigger; optional `ack` so the ticker knows the run finished.
 * - `reflection` — ticker or manual reflection pass; same ack contract.
 * - `invocation` — Phase 4: a parent agent's `agent_<child>` tool call.
 *   Carries the parent's free-text instruction, an ephemeral
 *   `replyTo` token used to deliver the result back, and the
 *   call-stack/depth that resolveToolPlan and the runtime use to
 *   refuse cycles or excessive nesting.
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
      replyTo: string
      parentRunId?: string | null
      parentToolId?: string | null
      callStack: string[]
      depth: number
    }
  | { type: 'shutdown' }

/**
 * Reply payload the child workflow resumes back on the parent's
 * one-shot reply hook. Always one message, never a stream.
 */
export type SubAgentReply =
  | { type: 'reply'; ok: true; output: string }
  | { type: 'reply'; ok: false; error: string }

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
