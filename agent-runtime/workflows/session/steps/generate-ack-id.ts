// Ack ids must be generated in their own step so workflow replays reuse the
// same token instead of desynchronizing `heartbeatAckToken(...)`.
export async function generateAckId(_input: {
  agentId: string
}): Promise<string> {
  'use step'
  await Promise.resolve()
  return (
    Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
  )
}
