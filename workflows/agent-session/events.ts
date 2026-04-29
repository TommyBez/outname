import type { UIMessage } from "ai"

/**
 * Session event union for `agentSessionWorkflow`.
 *
 * - `chat` — user turn; `replyToken` namespaces streamed chunks for the route.
 * - `heartbeat` — ticker or manual trigger; optional `ack` so the ticker knows the run finished.
 * - `shutdown` — agent disabled/deleted; loop exits and the ticker is torn down.
 */
export type SessionEvent =
  | {
      type: "chat"
      conversationId: string
      replyToken: string
      uiMessages: UIMessage[]
    }
  | {
      type: "heartbeat"
      ack?: string
    }
  | { type: "shutdown" }

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
