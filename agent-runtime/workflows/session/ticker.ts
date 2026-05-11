import { createHook, sleep } from 'workflow'
import { heartbeatAckToken } from './events'
import { generateAckId } from './steps/generate-ack-id'
import {
  pokeSessionHeartbeat,
  pokeSessionReflection,
  readHeartbeatSchedule,
} from './steps/ticker-control'

// Keep the ticker alive while heartbeat is disabled so UI toggles are picked
// up without restarting the session, but poll coarsely to keep idle cost low.
const DISABLED_POLL_MS = 5 * 60 * 1000
export async function agentTickerWorkflow(input: {
  agentId: string
  sessionEpoch: number
}): Promise<void> {
  'use workflow'
  const { agentId, sessionEpoch } = input

  while (true) {
    const schedule = await readHeartbeatSchedule({ agentId, sessionEpoch })
    const now = new Date().toISOString()

    if (!(schedule.heartbeat.enabled || schedule.reflection.enabled)) {
      await sleep(DISABLED_POLL_MS)
      continue
    }

    if (schedule.reflection.due) {
      await dispatchReflection({
        agentId,
        localDate: schedule.reflection.localDate,
        sessionEpoch,
      })
    }

    if (!schedule.heartbeat.enabled) {
      await sleep(Math.min(DISABLED_POLL_MS, schedule.reflection.intervalMs))
      continue
    }

    await dispatchHeartbeat({ agentId, sessionEpoch })

    console.log('[v0] agentTickerWorkflow: tick complete', { agentId, now })
    await sleep(schedule.heartbeat.intervalMs)
  }
}

async function dispatchHeartbeat(input: {
  agentId: string
  sessionEpoch: number
}): Promise<void> {
  const { agentId, sessionEpoch } = input
  const ack = await generateAckId({ agentId })

  const ackHook = createHook<{ done: true }>({
    token: heartbeatAckToken(agentId, sessionEpoch, ack),
  })

  await pokeSessionHeartbeat({ agentId, ack, sessionEpoch })

  // The ack is the session's "handler returned" signal. If it never arrives,
  // the liveness sweeper replaces the stalled ticker/session pair.
  await ackHook
}

async function dispatchReflection(input: {
  agentId: string
  localDate: string
  sessionEpoch: number
}): Promise<void> {
  const { agentId, localDate, sessionEpoch } = input
  const ack = await generateAckId({ agentId })

  const ackHook = createHook<{ done: true }>({
    token: heartbeatAckToken(agentId, sessionEpoch, ack),
  })

  await pokeSessionReflection({ agentId, ack, localDate, sessionEpoch })

  await ackHook
}
