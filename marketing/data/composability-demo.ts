export type StageId = 'tools' | 'subagents' | 'channels' | 'memory'
export type Corner = 'ne' | 'nw' | 'se' | 'sw'

export interface ComposabilityPart {
  id: string
  label: string
}

export interface ComposabilityStage {
  caption: string
  corner: Corner
  eyebrow: string
  id: StageId
  label: string
  parts: readonly ComposabilityPart[]
}

export const composabilityStages: readonly ComposabilityStage[] = [
  {
    caption:
      'Typed contracts. Rate-limited. Scoped per agent. The agent only calls what you bound.',
    corner: 'ne',
    eyebrow: '01 / 04',
    id: 'tools',
    label: 'Tools',
    parts: [
      { id: 'tool-slack', label: 'slack.search_threads' },
      { id: 'tool-gmail', label: 'gmail.draft' },
      { id: 'tool-cal', label: 'cal.create_event' },
    ],
  },
  {
    caption:
      'Delegate work. Each call is a traced run on its own. The parent waits or fires-and-forgets.',
    corner: 'nw',
    eyebrow: '02 / 04',
    id: 'subagents',
    label: 'Sub-agents',
    parts: [
      { id: 'sub-research', label: 'research-synthesizer' },
      { id: 'sub-digester', label: 'weekly-digester' },
    ],
  },
  {
    caption:
      'Where the agent listens and speaks. Slack DMs, email threads, webhook intake — bound, not guessed.',
    corner: 'se',
    eyebrow: '03 / 04',
    id: 'channels',
    label: 'Channels',
    parts: [
      { id: 'channel-slack', label: 'slack:@you' },
      { id: 'channel-email', label: 'email:inbound' },
    ],
  },
  {
    caption:
      'One markdown file per agent. The agent appends its own notes. You read them anytime.',
    corner: 'sw',
    eyebrow: '04 / 04',
    id: 'memory',
    label: 'Memory',
    parts: [{ id: 'memory-dreams', label: 'DREAMS.md · 47 entries' }],
  },
]
