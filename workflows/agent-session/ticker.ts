import { createHook, sleep } from 'workflow'
import { heartbeatAckToken } from './events'
import { generateAckId } from './steps/generate-ack-id'
import {
  pokeSessionHeartbeat,
  pokeSessionReflection,
  readHeartbeatSchedule,
} from './steps/ticker-control'

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
 *   1. Read the live heartbeat + reflection schedules from the agent row.
 *      - Both disabled → sleep `DISABLED_POLL_MS` and re-check.
 *      - Reflection due → dispatch it first, independent of heartbeat.
 *      - Heartbeat enabled → dispatch the normal proactive heartbeat.
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
  'use workflow'
  const { agentId } = input

  while (true) {
    const schedule = await readHeartbeatSchedule({ agentId })
    const now = new Date().toISOString()

    if (!(schedule.heartbeat.enabled || schedule.reflection.enabled)) {
      await sleep(DISABLED_POLL_MS)
      continue
    }

    if (schedule.reflection.due) {
      await dispatchReflection({
        agentId,
        localDate: schedule.reflection.localDate,
      })
    }

    if (!schedule.heartbeat.enabled) {
      await sleep(Math.min(DISABLED_POLL_MS, schedule.reflection.intervalMs))
      continue
    }

    await dispatchHeartbeat({ agentId })

    // Preserve the pre-Phase-5 normal heartbeat semantics: the rest
    // interval starts after the previous proactive event finishes.
    console.log('[v0] agentTickerWorkflow: tick complete', { agentId, now })
    await sleep(schedule.heartbeat.intervalMs)
  }
}

async function dispatchHeartbeat(input: { agentId: string }): Promise<void> {
  const { agentId } = input
  const ack = await generateAckId({ agentId })

  const ackHook = createHook<{ done: true }>({
    token: heartbeatAckToken(agentId, ack),
  })

  await pokeSessionHeartbeat({ agentId, ack })

  // Block until the session signals "handler returned".
  // If the session run dies mid-handler, the ack never arrives and
  // the workflow appears stuck — the cron liveness sweeper will
  // restart both this ticker and the session in that case.
  await ackHook
}

async function dispatchReflection(input: {
  agentId: string
  localDate: string
}): Promise<void> {
  const { agentId, localDate } = input
  const ack = await generateAckId({ agentId })

  const ackHook = createHook<{ done: true }>({
    token: heartbeatAckToken(agentId, ack),
  })

  await pokeSessionReflection({ agentId, ack, localDate })

  await ackHook
}
