import { createHook, sleep } from "workflow"
import { generateAckId } from "./steps/generate-ack-id"
import { pokeSessionHeartbeat } from "./steps/ticker-control"
import { heartbeatAckToken } from "./events"

/**
 * Phase 1 hardcodes the heartbeat cadence to 30 minutes for the only
 * agent kind that exists today. The full `agents.heartbeat_interval_mins`
 * column lands in Phase 2 alongside the rest of the agents table
 * generalisation; adding it now would create dead-code surface that
 * Phase 2 immediately rewrites.
 */
const HEARTBEAT_INTERVAL = "30m" as const

/**
 * Sibling workflow that drives an agent's session loop. One ticker
 * runs alongside each session; its lifecycle is owned by the session
 * (`startTicker` from inside `agentSessionWorkflow`'s setup, cancelled
 * via `stopTicker` in the session's `finally` block).
 *
 * Each iteration:
 *
 *   1. Generate a fresh ack id (in a step so retries are stable).
 *   2. Create the per-tick ack hook on the deterministic
 *      `agent:<id>:hb-ack:<ack>` token.
 *   3. Resume the session hook with `{ type: 'heartbeat', ack }` —
 *      this is what actually wakes the session for-await loop.
 *   4. Await the ack hook so we never let two heartbeats overlap.
 *   5. Sleep for the interval and repeat.
 *
 * Cancellation via `stopTicker` (see `steps/ticker-control.ts`) drops
 * the workflow run mid-iteration, which is fine: the session has
 * already broken out of its event loop by then and the cron sweeper
 * will spin up a fresh ticker if anyone re-enables the agent later.
 */
export async function agentTickerWorkflow(input: {
  agentId: string
}): Promise<void> {
  "use workflow"
  const { agentId } = input

  while (true) {
    const ack = await generateAckId({ agentId })

    const ackHook = createHook<{ done: true }>({
      token: heartbeatAckToken(agentId, ack),
    })

    await pokeSessionHeartbeat({ agentId, ack })

    // Block until the session signals "heartbeat handler returned".
    // If the session run dies mid-handler, the ack never arrives and
    // the workflow appears stuck — the cron liveness sweeper will
    // restart both this ticker and the session in that case.
    await ackHook

    await sleep(HEARTBEAT_INTERVAL)
  }
}
