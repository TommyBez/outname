/**
 * Generate a fresh, opaque ack token for one heartbeat tick.
 *
 * Lives in its own `"use step"` so the random + timestamp bits are
 * computed at most once per tick and cached across workflow replays —
 * if we generated this inline in the ticker workflow body we'd
 * repeatedly produce different values on replay and the
 * `heartbeatAckToken(...)` derived hook would never match.
 */
export async function generateAckId(_input: {
  agentId: string
}): Promise<string> {
  'use step'
  return (
    Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
  )
}
