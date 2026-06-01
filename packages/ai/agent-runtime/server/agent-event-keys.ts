export function replyNamespaceForEvent(eventId: string): string {
  return `reply:${eventId}`
}

export function eventActivityNamespace(eventWorkflowRunId: string): string {
  return `events:${eventWorkflowRunId}`
}

export function scheduledBucketKey(input: {
  agentId: string
  intervalMinutes: number
  now: Date
  type: 'dreaming' | 'heartbeat'
}): string {
  const intervalMs = Math.max(1, input.intervalMinutes) * 60_000
  const bucket = Math.floor(input.now.getTime() / intervalMs)
  return `sched:${input.agentId}:${input.type}:${bucket}`
}

export function scheduledConcurrencyKey(input: {
  agentId: string
  intervalMinutes: number
  now: Date
  type: 'dreaming' | 'heartbeat'
}): string {
  return scheduledBucketKey(input)
}

export function scheduledDailyKey(input: {
  agentId: string
  localDate: string
  time: string
  type: 'dreaming' | 'heartbeat'
}): string {
  const slot = input.time.replace(':', '')
  return `sched:${input.agentId}:${input.type}:daily:${input.localDate}:${slot}`
}
