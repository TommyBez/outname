export async function startNextQueuedEvent(input: {
  concurrencyKey: string | null
}): Promise<void> {
  'use step'
  if (!input.concurrencyKey) {
    return
  }
  const { startNextQueuedForConcurrencyKey } = await import(
    '@/agent-runtime/server/agent-events'
  )
  await startNextQueuedForConcurrencyKey(input.concurrencyKey)
}
