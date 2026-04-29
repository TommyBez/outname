import { createHook, sleep } from "workflow"
import { generateAckId } from "./steps/generate-ack-id"
import {
  pokeSessionHeartbeat,
  readHeartbeatSchedule,
} from "./steps/ticker-control"
import { heartbeatAckToken } from "./events"

/**
 * Cadence used while the agent's heartbeat is disabled. The ticker
 * stays alive but only re-checks the DB every 5 minutes so a UI
 * toggle picks up cleanly without forcing a session restart. Kept
 * deliberately coarse — a disabled agent should be near-zero cost.
 */
const DISABLED_POLL_MS = 5 * 60 * 1000

/**
 * Sibling workflow that drives an agent's session loop. One ticker
 * runs alongside each session; its lifecycle is owned by the session
 * (`startTicker` from inside `agentSessionWorkflow`'s setup, cancelled
 * via `stopTicker` in the session's `finally` block).
 *
 * Each iteration:
 *
 *   1. Read the live heartbeat schedule from the agent row.
 *      - Disabled → sleep `DISABLED_POLL_MS` and re-check. This keeps
 *        the ticker alive so a re-enable doesn't require a session
 *        restart, while costing one DB read per 5 min.
 *      - Enabled  → fall through to the heartbeat handshake.
 *   2. Generate a fresh ack id (in a step so retries are stable).
 *   3. Create the per-tick ack hook on the deterministic
 *      `agent:<id>:hb-ack:<ack>` token.
 *   4. Resume the session hook with `{ type: 'heartbeat', ack }` —
 *      this is what actually wakes the session for-await loop.
 *   5. Await the ack hook so we never let two heartbeats overlap.
 *   6. Sleep for `intervalMs` (= `heartbeat_interval_minutes * 60_000`)
 *      and repeat.
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
    const schedule = await readHeartbeatSchedule({ agentId })

    if (!schedule.enabled) {
      await sleep(DISABLED_POLL_MS)
      continue
    }

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

    await sleep(schedule.intervalMs)
  }
}
