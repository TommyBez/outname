// The agent-anatomy section reframes an outname agent as a concrete, readable
// directory — the way vercel.com/eve grounds its product in "an agent is a
// directory". Each walkthrough step highlights one node in the tree and shows
// the snippet plus the platform primitive that backs it.

export type AnatomyStepId =
  | 'memory'
  | 'model'
  | 'tools'
  | 'channels'
  | 'subagents'
  | 'heartbeat'
  | 'skills'
  | 'budget'

export interface AgentTreeNode {
  /** Indentation level inside the tree. Root children are depth 1. */
  depth: number
  /** Stable id; matches a step id when the node is the focus of a step. */
  id: string
  kind: 'dir' | 'file'
  label: string
  /** The step that highlights this node, when any. */
  stepId?: AnatomyStepId
}

export interface AnatomyStep {
  caption: string
  /** Short code/markdown snippet rendered as a mono block. */
  code: string
  id: AnatomyStepId
  /** Two-digit ordinal, e.g. "01". */
  index: string
  /** Tree node this step focuses. */
  node: string
  /** The platform primitive that powers the capability. */
  primitive: string
  title: string
}

export const agentSlug = 'inbox-sentinel'

export const agentTree: readonly AgentTreeNode[] = [
  {
    depth: 1,
    id: 'memory',
    kind: 'file',
    label: 'MEMORY.md',
    stepId: 'memory',
  },
  { depth: 1, id: 'tasks', kind: 'file', label: 'TASKS.md' },
  { depth: 1, id: 'dreams', kind: 'file', label: 'DREAMS.md' },
  {
    depth: 1,
    id: 'config',
    kind: 'file',
    label: 'agent.config.ts',
    stepId: 'model',
  },
  { depth: 1, id: 'tools', kind: 'dir', label: 'tools/', stepId: 'tools' },
  {
    depth: 1,
    id: 'channels',
    kind: 'dir',
    label: 'channels/',
    stepId: 'channels',
  },
  {
    depth: 1,
    id: 'subagents',
    kind: 'dir',
    label: 'subagents/',
    stepId: 'subagents',
  },
  { depth: 1, id: 'skills', kind: 'dir', label: 'skills/', stepId: 'skills' },
  {
    depth: 1,
    id: 'schedule',
    kind: 'file',
    label: 'schedule.cron',
    stepId: 'heartbeat',
  },
  {
    depth: 1,
    id: 'budget',
    kind: 'file',
    label: 'budget.json',
    stepId: 'budget',
  },
]

export const anatomySteps: readonly AnatomyStep[] = [
  {
    caption:
      'One human-readable markdown file per agent. It appends its own notes as it works. You read or edit them anytime.',
    code: `## 2026-05-13
+ skip auto-summary on Sundays
+ user prefers "Tomas" in replies`,
    id: 'memory',
    index: '01',
    node: 'memory',
    primitive: 'Vercel Sandbox',
    title: 'Memory it writes itself',
  },
  {
    caption:
      'Pick the inference provider and model per agent. Bring your own keys — the runtime stays model-agnostic.',
    code: `model: {
  provider: "ai-gateway",
  id: "claude-sonnet-4-6",
}`,
    id: 'model',
    index: '02',
    node: 'config',
    primitive: 'AI Gateway',
    title: 'Any model you trust',
  },
  {
    caption:
      'Typed contracts, rate-limited, scoped per agent. The agent only ever calls what you bind to it.',
    code: `tools: [
  slack.search_threads,
  gmail.draft,
  cal.create_event,
]`,
    id: 'tools',
    index: '03',
    node: 'tools',
    primitive: 'Tool providers',
    title: 'Tools, bound not guessed',
  },
  {
    caption:
      'Where the agent listens and speaks. In-app chat and Slack today — same agent, every surface.',
    code: `channels: [
  "chat:in-app",
  "slack:@you",
]`,
    id: 'channels',
    index: '04',
    node: 'channels',
    primitive: 'Vercel Chat SDK',
    title: 'One agent, every surface',
  },
  {
    caption:
      'Hand work to a specialist agent. Each call is its own traced run; the parent waits or fires-and-forgets.',
    code: `delegate("research-synthesizer", {
  task: "compare this week vs last",
})`,
    id: 'subagents',
    index: '05',
    node: 'subagents',
    primitive: 'Vercel Workflow',
    title: 'Sub-agents on call',
  },
  {
    caption:
      'Wakes on a schedule and works unprompted. Heartbeat and dreaming runs need no human in the loop.',
    code: `schedule: "0 6 * * *"   # daily 06:00
on: ["heartbeat", "dream"]`,
    id: 'heartbeat',
    index: '06',
    node: 'schedule',
    primitive: 'Vercel Workflow',
    title: 'A heartbeat of its own',
  },
  {
    caption:
      'Installable capability packages that run in a dedicated, persistent Skill Sandbox — isolated from memory.',
    code: `skills/
└─ weekly-digest/
   ├─ SKILL.md
   └─ run.ts`,
    id: 'skills',
    index: '07',
    node: 'skills',
    primitive: 'Skill Sandbox',
    title: 'Skills it can install',
  },
  {
    caption:
      'Per-agent spend guardrails with estimated and actual cost. Autonomous work can never run away.',
    code: `budget: {
  monthly_usd: 20,
  per_run_usd: 0.50,
}`,
    id: 'budget',
    index: '08',
    node: 'budget',
    primitive: 'Budgets',
    title: 'A budget it respects',
  },
]

export const anatomyStepCount = anatomySteps.length
