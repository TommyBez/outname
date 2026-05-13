import type { LucideIcon } from 'lucide-react'
import {
  ActivityIcon,
  BotIcon,
  BrainIcon,
  CalendarClockIcon,
  FileClockIcon,
  FileTextIcon,
  HammerIcon,
  MailIcon,
  MessagesSquareIcon,
  MousePointerClickIcon,
  NetworkIcon,
  Settings2Icon,
} from 'lucide-react'

export type FeatureId = 'chat' | 'heartbeat' | 'memory' | 'tools' | 'reflection'
export type ToolId = 'resend' | 'calcom' | 'browser' | 'subagent'
export type MemoryId = 'identity' | 'instructions' | 'user' | 'logs' | 'dreams'

export interface FeatureMode {
  accent: string
  href: string
  icon: LucideIcon
  id: FeatureId
  label: string
  metric: string
  signal: string
  steps: readonly string[]
  title: string
}

export interface ToolMode {
  accent: string
  config: readonly string[]
  icon: LucideIcon
  id: ToolId
  label: string
  output: string
  requirement: string
}

export interface MemoryFile {
  detail: string
  id: MemoryId
  label: string
  path: string
  tag: string
}

export const featureModes: readonly FeatureMode[] = [
  {
    accent: 'bg-accent',
    href: '/login?from=/agents',
    icon: MessagesSquareIcon,
    id: 'chat',
    label: 'Chat',
    metric: 'stream',
    signal: 'the request is saved before the agent starts',
    steps: ['save the request', 'resume the session', 'stream the reply'],
    title: 'Turn conversations into durable agent runs.',
  },
  {
    accent: 'bg-foreground',
    href: '/login?from=/agents/new',
    icon: CalendarClockIcon,
    id: 'heartbeat',
    label: 'Heartbeat',
    metric: '5m-1d',
    signal: 'each tick waits for the previous run',
    steps: ['choose cadence', 'run proactive work', 'recover sessions'],
    title: 'Let agents check in without a prompt.',
  },
  {
    accent: 'bg-accent',
    href: '/login?from=/agents',
    icon: BrainIcon,
    id: 'memory',
    label: 'Memory',
    metric: 'md files',
    signal: 'markdown files are mirrored after each event',
    steps: ['seed identity', 'maintain user context', 'mirror logs'],
    title: 'Give every agent readable memory.',
  },
  {
    accent: 'bg-foreground',
    href: '/login?from=/agents',
    icon: HammerIcon,
    id: 'tools',
    label: 'Tools',
    metric: 'catalog',
    signal: 'Resend, Cal.com, browser, and sub-agents',
    steps: ['attach approved tools', 'resolve credentials', 'show failures'],
    title: 'Attach real tools to the right agent.',
  },
  {
    accent: 'bg-accent',
    href: '/login?from=/agents',
    icon: FileClockIcon,
    id: 'reflection',
    label: 'Reflection',
    metric: 'dreams',
    signal: 'daily self-review output',
    steps: ['run reflection', 'read DREAMS.md', 'adjust plans carefully'],
    title: 'Read how the agent reflects between runs.',
  },
] as const

export const tools: readonly ToolMode[] = [
  {
    accent: 'bg-accent',
    config: ['fromEmail', 'to', 'subject', 'text/html'],
    icon: MailIcon,
    id: 'resend',
    label: 'Resend email',
    output: 'sends through your verified sender',
    requirement: 'Resend API key',
  },
  {
    accent: 'bg-foreground',
    config: ['method', 'path', 'query', 'body'],
    icon: CalendarClockIcon,
    id: 'calcom',
    label: 'Cal.com scheduling',
    output: 'checks slots, bookings, and event types',
    requirement: 'Cal.com API key',
  },
  {
    accent: 'bg-accent',
    config: ['open', 'snapshot', 'click', 'screenshot'],
    icon: MousePointerClickIcon,
    id: 'browser',
    label: 'agent-browser',
    output: 'drives a sandboxed browser session',
    requirement: 'browser tool sandbox',
  },
  {
    accent: 'bg-foreground',
    config: ['agent_<id>', 'instruction', 'final reply'],
    icon: NetworkIcon,
    id: 'subagent',
    label: 'Sub-agent',
    output: 'returns a focused result to the parent',
    requirement: 'another owned agent',
  },
] as const

export const memoryFiles: readonly MemoryFile[] = [
  {
    detail: 'Compact persona card seeded from the agent form.',
    id: 'identity',
    label: 'Identity',
    path: 'IDENTITY.md',
    tag: 'bootstrap',
  },
  {
    detail: 'Operating manual used by the session prompt.',
    id: 'instructions',
    label: 'Instructions',
    path: 'AGENTS.md',
    tag: 'user edit',
  },
  {
    detail: 'Stable facts the agent may maintain over time.',
    id: 'user',
    label: 'User profile',
    path: 'USER.md',
    tag: 'agent memory',
  },
  {
    detail: 'Daily event logs mirrored after chat, heartbeat, and reflection.',
    id: 'logs',
    label: 'Timeline',
    path: 'logs/YYYY-MM-DD.md',
    tag: 'mirror',
  },
  {
    detail: 'Reflection output stored in DREAMS.md.',
    id: 'dreams',
    label: 'Dreams',
    path: 'DREAMS.md',
    tag: 'reflection',
  },
] as const

export const routeLinks = [
  {
    href: '/login?from=/dashboard',
    icon: ActivityIcon,
    label: 'Dashboard',
    meta: 'monitor agents and sessions',
  },
  {
    href: '/login?from=/agents/new',
    icon: BotIcon,
    label: 'Create agent',
    meta: 'model, memory, cadence',
  },
  {
    href: '/login?from=/agents',
    icon: MessagesSquareIcon,
    label: 'Chat',
    meta: 'talk to a running agent',
  },
  {
    href: '/login?from=/agents',
    icon: FileTextIcon,
    label: 'Memory files',
    meta: 'read mirrored markdown',
  },
  {
    href: '/login?from=/agents',
    icon: HammerIcon,
    label: 'Tools',
    meta: 'attach catalog and sub-agents',
  },
  {
    href: '/login?from=/settings',
    icon: Settings2Icon,
    label: 'Connections',
    meta: 'manage API keys',
  },
] as const

export const loopWords = [
  'chat',
  'heartbeat',
  'reflection',
  'tools',
  'files',
] as const

export function featureById(id: FeatureId): FeatureMode {
  return featureModes.find((feature) => feature.id === id) ?? featureModes[0]
}

export function toolById(id: ToolId): ToolMode {
  return tools.find((toolMode) => toolMode.id === id) ?? tools[0]
}

export function memoryById(id: MemoryId): MemoryFile {
  return memoryFiles.find((file) => file.id === id) ?? memoryFiles[0]
}
