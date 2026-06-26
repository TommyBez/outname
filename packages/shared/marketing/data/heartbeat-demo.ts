// A heartbeat day-in-the-life. Event kinds map to real runtime concepts:
// scheduled heartbeat runs, the Slack channel, file tools writing the sandbox
// markdown, sub-agent delegation, the Resend connector, and dreaming passes.

export type HeartbeatKind =
  | 'heartbeat'
  | 'slack'
  | 'file'
  | 'subagent'
  | 'resend'
  | 'dreaming'

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
    detail: 'Daily run fired',
    event: 'heartbeat',
    kind: 'heartbeat',
    time: '06:00',
  },
  {
    detail: '#ops blocker flagged · customer reply waiting',
    event: 'channel',
    kind: 'slack',
    time: '06:00',
  },
  {
    detail: '+ skip auto-summary on Sundays → MEMORY.md',
    emphasis: 'memory',
    event: 'writeFile',
    kind: 'file',
    time: '06:01',
  },
  {
    detail: 'Calendar conflict spotted in CALENDAR.md',
    event: 'heartbeat',
    kind: 'heartbeat',
    time: '09:14',
  },
  {
    detail: 'Tue 15:00 → Wed 10:00 drafted in TASKS.md',
    event: 'writeFile',
    kind: 'file',
    time: '09:14',
  },
  {
    detail: 'research-synthesizer · 4.2s',
    event: 'subagent',
    kind: 'subagent',
    time: '11:02',
  },
  {
    detail: '+ user prefers "Tomas" in replies → MEMORY.md',
    emphasis: 'memory',
    event: 'writeFile',
    kind: 'file',
    time: '11:02',
  },
  {
    detail: '5 logs reviewed → DREAMS.md',
    event: 'dreaming',
    kind: 'dreaming',
    time: '14:01',
  },
  {
    detail: 'Weekly digest sent · 0 follow-ups',
    emphasis: 'highlight',
    event: 'resend',
    kind: 'resend',
    time: '18:00',
  },
]
