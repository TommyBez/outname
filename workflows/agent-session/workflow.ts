import { createHook } from "workflow"
import type { AgentKind } from "@/lib/db/schema"
import { handleChat } from "./handlers/handle-chat"
import { handleHeartbeat } from "./handlers/handle-heartbeat"
import { sessionToken, type SessionEvent } from "./events"
import { endOfEvent } from "./steps/end-of-event"
import {
  ackHeartbeat,
  reapOrphanTicker,
  startTicker,
  stopTicker,
} from "./steps/ticker-control"

/**
 * Long-lived "session" workflow — one running run per `enabled = true`
 * agent. Replaces the per-trigger `dailyEmailBrief` and per-turn
 * `agentChat` workflows.
 *
 *   1. Boot a sibling ticker workflow that drives heartbeat events.
 *   2. Open the session hook and spin a for-await loop pulling
 *      `SessionEvent`s.
 *   3. Dispatch each event to its handler (`chat` / `heartbeat`),
 *      acking the ticker after each heartbeat completes so the next
 *      tick is gated on this one.
 *   4. After every event, run `endOfEvent` to flush the agent's
 *      markdown notes from the sandbox into `agent_files` and stop
 *      the sandbox so Vercel snapshots the filesystem.
 *   5. On shutdown, cancel the ticker workflow.
 *
 * Handler-level errors are caught so the session never dies on a bad
 * turn. Errors from the lifecycle steps themselves (`startTicker` /
 * `endOfEvent`) propagate up and terminate the run — the cron
 * liveness sweeper restarts it.
 *
 * The `kind` argument is part of the input so chat and heartbeat
 * handlers can dispatch to per-kind agent factories without re-reading
 * the agent row on every event.
 */
export async function agentSessionWorkflow(input: {
  agentId: string
  kind: AgentKind
}): Promise<void> {
  "use workflow"
  const { agentId, kind } = input

  // Defend against the "previous session crashed mid-handler and left
  // its ticker hanging on its ackHook" failure mode before we start a
  // fresh ticker on top of it.
  await reapOrphanTicker({ agentId })

  const { tickerRunId } = await startTicker({ agentId })

  try {
    const hook = createHook<SessionEvent>({
      token: sessionToken(agentId),
    })

    for await (const event of hook) {
      if (event.type === "shutdown") break

      try {
        if (event.type === "chat") {
          await handleChat({
            agentId,
            kind,
            conversationId: event.conversationId,
            replyToken: event.replyToken,
            uiMessages: event.uiMessages,
          })
        } else if (event.type === "heartbeat") {
          try {
            await handleHeartbeat({ agentId, kind })
          } finally {
            // Always release the ticker, even if the handler threw —
            // an unbroken handshake would freeze the heartbeat loop
            // forever.
            if (event.ack) {
              await ackHeartbeat({ agentId, ack: event.ack })
            }
          }
        }
      } catch (err) {
        // Handlers own their own per-run breadcrumbs (failed runs row
        // for heartbeat; nothing to persist for chat). We log here for
        // observability and continue the loop — one bad event must not
        // poison the long-lived session.
        console.error("[v0] agentSessionWorkflow: handler failed", err)
      }

      await endOfEvent({ agentId })
    }
  } finally {
    await stopTicker({ agentId, tickerRunId })
  }
}
