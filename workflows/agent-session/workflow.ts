import { createHook } from 'workflow'
import { type SessionEvent, sessionToken } from './events'
import { handleChat } from './handlers/handle-chat'
import { handleHeartbeat } from './handlers/handle-heartbeat'
import { endOfEvent } from './steps/end-of-event'
import {
  ackHeartbeat,
  reapOrphanTicker,
  startTicker,
  stopTicker,
} from './steps/ticker-control'
import { createPendingWrites, type PendingWrites } from './tools/pending-writes'

/**
 * Long-lived "session" workflow — one running run per `enabled = true`
 * agent.
 *
 *   1. Boot a sibling ticker workflow that drives heartbeat events.
 *   2. Open the session hook and spin a for-await loop pulling
 *      `SessionEvent`s.
 *   3. Dispatch each event to its handler (`chat` / `heartbeat`),
 *      acking the ticker after each heartbeat completes so the next
 *      tick is gated on this one. Each handler returns the per-event
 *      `pending` queue of memory mutations.
 *   4. After every event, run `endOfEvent` to:
 *        - flush the queued memory mutations into the system sandbox,
 *        - mirror every `*.md` into `agent_files`,
 *        - shut both sandboxes so Vercel snapshots their filesystems.
 *      If a handler threw, we still call `endOfEvent` with a fresh
 *      empty queue so the sandboxes get released cleanly.
 *   5. On shutdown, cancel the ticker workflow.
 *
 * Phase 2 drops the `kind` argument: every agent is generic, the
 * handlers read whatever they need (system prompt, model, persona
 * files) from the agent row + system sandbox at event time.
 */
export async function agentSessionWorkflow(input: {
  agentId: string
}): Promise<void> {
  'use workflow'
  const { agentId } = input

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
      if (event.type === 'shutdown') {
        break
      }

      // The handler returns the per-event queue on success; if it
      // throws we still need to call endOfEvent with a fresh empty
      // queue so the sandboxes release.
      let pending: PendingWrites = createPendingWrites()

      try {
        if (event.type === 'chat') {
          const result = await handleChat({
            agentId,
            conversationId: event.conversationId,
            replyToken: event.replyToken,
            uiMessages: event.uiMessages,
          })
          pending = result.pending
        } else if (event.type === 'heartbeat') {
          try {
            const result = await handleHeartbeat({ agentId })
            pending = result.pending
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
        // Handlers own their own per-run breadcrumbs (failed `runs` row
        // for heartbeat; nothing to persist for chat). We log here for
        // observability and continue the loop — one bad event must not
        // poison the long-lived session.
        console.error('[v0] agentSessionWorkflow: handler failed', err)
      }

      await endOfEvent({ agentId, pending })
    }
  } finally {
    await stopTicker({ agentId, tickerRunId })
  }
}
