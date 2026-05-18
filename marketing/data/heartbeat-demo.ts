export type HeartbeatKind =
  | 'cron'
  | 'slack'
  | 'memory'
  | 'heartbeat'
  | 'cal'
  | 'subagent'
  | 'gmail'

export interface HeartbeatEvent {
  detail: string
  emphasis?: 'memory' | 'highlight'
  event: string
  kind: HeartbeatKind
  time: string
}

export const heartbeatStats = [
  { label: 'Unprompted runs', value: '21' },
  { label: 'Memory entries written', value: '+8' },
  { label: 'Questions asked', value: '0' },
] as const

export const heartbeatEvents: readonly HeartbeatEvent[] = [
  {
    detail: 'daily.triage queued',
    event: 'cron.fire',
    kind: 'cron',
    time: '06:00',
  },
  {
    detail: '14 threads scanned · 2 flagged',
    event: 'slack.read',
    kind: 'slack',
    time: '06:00',
  },
  {
    detail: '+ skip auto-summary on Sundays',
    emphasis: 'memory',
    event: 'memory.write',
    kind: 'memory',
    time: '06:01',
  },
  {
    detail: 'calendar conflict spotted · draft sent',
    event: 'heartbeat',
    kind: 'heartbeat',
    time: '09:14',
  },
  {
    detail: 'tue 15:00 → wed 10:00 proposed',
    event: 'cal.draft',
    kind: 'cal',
    time: '09:14',
  },
  {
    detail: 'research-synthesizer · 4.2s',
    event: 'subagent.call',
    kind: 'subagent',
    time: '11:02',
  },
  {
    detail: '+ user prefers "Tomas" in replies',
    emphasis: 'memory',
    event: 'memory.write',
    kind: 'memory',
    time: '11:02',
  },
  {
    detail: 'weekly.digest queued',
    event: 'cron.fire',
    kind: 'cron',
    time: '14:00',
  },
  {
    detail: '5 threads summarized · digest ready',
    event: 'gmail.draft',
    kind: 'gmail',
    time: '14:01',
  },
  {
    detail: 'weekly digest sent · 0 follow-ups',
    emphasis: 'highlight',
    event: 'gmail.send',
    kind: 'gmail',
    time: '18:00',
  },
]
