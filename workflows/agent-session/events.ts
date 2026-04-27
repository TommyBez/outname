import type { UIMessage } from "ai"

/**
 * Events processed by `agentSessionWorkflow`. Each iteration of the
 * for-await loop pulls one of these from the agent's session hook.
 *
 * - `chat` — a user turn from `POST /api/agents/:id/chat`. The route
 *   generates a fresh `replyToken` for the turn and the chat handler
 *   streams `UIMessageChunk`s into a namespaced sub-stream of the
 *   session run keyed by that token, which the route then pipes into
 *   the HTTP response.
 * - `heartbeat` — the periodic tick driven by `agentTickerWorkflow`,
 *   or a one-shot push from `POST /api/agents/:id/trigger`. When `ack`
 *   is set the session resumes that hook after the handler returns so
 *   the ticker knows the heartbeat is done; ad-hoc trigger pokes leave
 *   it unset. (A `force` field will land in Phase 2 when per-kind
 *   rate-limit / time-of-day gates are introduced; not modeled today
 *   because no handler reads it.)
 * - `shutdown` — pushed by `stopAgentSession` when the agent is
 *   disabled or deleted. The for-await loop breaks and the workflow's
 *   finally block tears the ticker down.
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

/* -------------------------------------------------------------------------- */
/* Token helpers                                                               */
/*                                                                             */
/* All tokens are derived deterministically from `agentId` so external code   */
/* (the API routes and the cron sweeper) can always derive the right token   */
/* without consulting any state beyond the agent id.                          */
/* -------------------------------------------------------------------------- */

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
