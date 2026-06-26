// The agent-anatomy section walks a real outname agent's sandbox. Every file
// below is canonical in the runtime (see the AGENTS.md template and
// sandbox-file-helpers/paths.ts). Snippets reflect the documented conventions
// for each file — nothing here is invented product surface.

export type AnatomyStepId =
  | 'instructions'
  | 'identity'
  | 'soul'
  | 'user'
  | 'memory'
  | 'tasks'
  | 'calendar'
  | 'goals'
  | 'dreams'

/** Who owns each file: the operator authors some, the agent maintains others. */
export type FileOwner = 'user' | 'agent' | 'shared'

export interface AgentTreeNode {
  /** Indentation level inside the tree. Root children are depth 1. */
  depth: number
  /** Stable id; matches a step id when the node is the focus of a step. */
  id: string
  kind: 'dir' | 'file'
  label: string
  owner?: FileOwner
  /** The step that highlights this node, when any. */
  stepId?: AnatomyStepId
}

export interface AnatomyStep {
  caption: string
  /** Short markdown excerpt rendered as a mono block. */
  code: string
  id: AnatomyStepId
  /** Two-digit ordinal, e.g. "01". */
  index: string
  /** Tree node this step focuses. */
  node: string
  /** A real convention from the runtime, shown as a tag. */
  note: string
  owner: FileOwner
  title: string
}

export const agentSlug = 'inbox-sentinel'

export const ownerLabel: Record<FileOwner, string> = {
  agent: 'Agent writes it',
  shared: 'Shared',
  user: 'You author it',
}

export const agentTree: readonly AgentTreeNode[] = [
  {
    depth: 1,
    id: 'instructions',
    kind: 'file',
    label: 'AGENTS.md',
    owner: 'user',
    stepId: 'instructions',
  },
  {
    depth: 1,
    id: 'identity',
    kind: 'file',
    label: 'IDENTITY.md',
    owner: 'user',
    stepId: 'identity',
  },
  {
    depth: 1,
    id: 'soul',
    kind: 'file',
    label: 'SOUL.md',
    owner: 'user',
    stepId: 'soul',
  },
  {
    depth: 1,
    id: 'user',
    kind: 'file',
    label: 'USER.md',
    owner: 'shared',
    stepId: 'user',
  },
  {
    depth: 1,
    id: 'memory',
    kind: 'file',
    label: 'MEMORY.md',
    owner: 'agent',
    stepId: 'memory',
  },
  {
    depth: 1,
    id: 'tasks',
    kind: 'file',
    label: 'TASKS.md',
    owner: 'agent',
    stepId: 'tasks',
  },
  {
    depth: 1,
    id: 'calendar',
    kind: 'file',
    label: 'CALENDAR.md',
    owner: 'agent',
    stepId: 'calendar',
  },
  {
    depth: 1,
    id: 'goals',
    kind: 'file',
    label: 'GOALS.md',
    owner: 'agent',
    stepId: 'goals',
  },
  {
    depth: 1,
    id: 'dreams',
    kind: 'file',
    label: 'DREAMS.md',
    owner: 'agent',
    stepId: 'dreams',
  },
  { depth: 1, id: 'logs', kind: 'dir', label: 'logs/', owner: 'agent' },
]

export const anatomySteps: readonly AnatomyStep[] = [
  {
    caption:
      'Its operational manual. You write the custom instructions; the agent reads them at the start of every event.',
    code: `# AGENTS.md
## User custom instructions
- Triage Slack before 09:00.
- Never send external email
  without a confirm.`,
    id: 'instructions',
    index: '01',
    node: 'instructions',
    note: 'Read every event',
    owner: 'user',
    title: 'How it should behave',
  },
  {
    caption:
      'A compact identity card: name, role, vibe. Short by design, it is injected into every prompt the agent runs.',
    code: `# Inbox Sentinel
Role: personal chief of staff
Vibe: terse, proactive`,
    id: 'identity',
    index: '02',
    node: 'identity',
    note: 'Injected every turn',
    owner: 'user',
    title: 'Who it is, at a glance',
  },
  {
    caption:
      'Its persona, voice, and self-model. Also injected every turn — if behavior drifts from it, the agent flags the contradiction.',
    code: `# SOUL.md
I default to action over
explanation. I surface conflicts
instead of working around them.`,
    id: 'soul',
    index: '03',
    node: 'soul',
    note: 'Injected every turn',
    owner: 'user',
    title: 'Its voice and self-model',
  },
  {
    caption:
      'The profile of the human it serves. You can seed it; the agent keeps it current as conversations reveal stable facts.',
    code: `## Basic Info
- Preferred name: Tomas
- Timezone: Europe/Rome
## Hard Boundaries
- Ask before external email.`,
    id: 'user',
    index: '04',
    node: 'user',
    note: 'It maintains, you can edit',
    owner: 'shared',
    title: 'What it knows about you',
  },
  {
    caption:
      'Broader durable facts, commitments, and evidence. Append-only by convention, with a citation back to where each fact came from.',
    code: `## 2026-05-13
- Skip auto-summary on Sundays.
- Prefers "Tomas" in replies.
  (msg_8f12)`,
    id: 'memory',
    index: '05',
    node: 'memory',
    note: 'Append-only',
    owner: 'agent',
    title: 'Durable facts it commits',
  },
  {
    caption:
      'Active tactical items with status and dependencies, kept current without waiting for a reminder. Plain GitHub-flavored checkboxes.',
    code: `- [x] Draft weekly digest
- [ ] Confirm Tue 15:00 move
- [ ] Chase invoice #204`,
    id: 'tasks',
    index: '06',
    node: 'tasks',
    note: 'Checkbox conventions',
    owner: 'agent',
    title: 'The work it is tracking',
  },
  {
    caption:
      'Known time-bound events and deadlines, ISO-8601 dated. The agent adds, updates, and removes entries as plans change.',
    code: `- 2026-05-14T10:00Z Design review
- 2026-05-16 Invoice #204 due`,
    id: 'calendar',
    index: '07',
    node: 'calendar',
    note: 'ISO-8601 dated',
    owner: 'agent',
    title: 'Its time-bound context',
  },
  {
    caption:
      'Long-horizon objectives, updated rarely. The agent consults them before deciding what is worth surfacing in a heartbeat.',
    code: `- Keep inbox under 10 threads.
- Protect deep-work mornings.`,
    id: 'goals',
    index: '08',
    node: 'goals',
    note: 'Steers every heartbeat',
    owner: 'agent',
    title: 'The long horizon',
  },
  {
    caption:
      'Notes from dreaming passes: pattern anticipation and self-evaluation, written only when there is real signal, with log citations.',
    code: `## 2026-05-12
- Replies spike on Mondays.
  (logs/2026-05-11.md:14)`,
    id: 'dreams',
    index: '09',
    node: 'dreams',
    note: 'Written while dreaming',
    owner: 'agent',
    title: 'What it learns in its sleep',
  },
]

export const anatomyStepCount = anatomySteps.length
