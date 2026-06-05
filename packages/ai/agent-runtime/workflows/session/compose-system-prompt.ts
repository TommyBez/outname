import {
  getSystemSandbox,
  isMissingSystemSandboxError,
} from '@outname/ai/agent-runtime/server/agent-sandbox'
import {
  EAGER_CONTEXT_PATHS,
  READ_ONLY_FOR_AGENT,
} from '@outname/ai/agent-runtime/workflows/session/tools/persona-paths'
import { listTrackedArchitectureFiles } from '@outname/ai/agent-runtime/workflows/session/tools/sandbox-file-helpers/list'
import { readLiveMemory } from '@outname/ai/agent-runtime/workflows/session/tools/sandbox-file-helpers/read'
import type { Reconnect } from '@outname/ai/tools/catalog/types'
import { reconnectPromptLine } from '@outname/ai/tools/runtime/reconnect-renderer'
import { nonRetryableStepErrorFromUnknown } from '@outname/shared/server/workflow-step-errors'

export interface ComposeSystemPromptArgs {
  agentId: string
  agentName: string
  eventKind?: 'chat' | 'dreaming' | 'heartbeat' | 'invocation'
  hasSkillTools?: boolean
  nowIso?: string
  reconnects?: readonly Reconnect[]
}

const PLATFORM_INVARIANTS = `## Platform invariants

- Your persistent system sandbox is rooted at /vercel/sandbox. Use
  readFile, writeFile, listFiles, and grepFiles for durable file work.
  Direct bash execution is not available in the system memory sandbox.
- AGENTS.md and SOUL.md are user-owned bootstrap files. writeFile will
  refuse to modify them. If a change is needed, ask the user to make it
  through the agent settings UI.
- IDENTITY.md is also a user-owned bootstrap file. writeFile will
  refuse to modify it; ask the user to edit it through the agent
  settings UI.
- USER.md is an eager user profile file when present. You may create
  or update it with writeFile when conversations reveal durable
  user preferences, identity, goals, or hard boundaries.
- writeFile writes immediately. Same-turn readFile, listFiles, and
  grepFiles naturally see the new content.
- The sandbox filesystem is the source of truth. The UI may cache common
  markdown files, but sandbox contents win if cache and filesystem differ.
- Prefer doing the smallest correct thing and stopping. Long tool
  loops cost the user money and latency.
- When unsure of a fact about the user, check your memory files
  first; only ask if it's truly missing.
`

const MAX_EAGER_CONTEXT_CHARS = 12_000
const EAGER_CONTEXT_PATH_SET: ReadonlySet<string> = new Set(EAGER_CONTEXT_PATHS)

export async function composeSystemPrompt(
  args: ComposeSystemPromptArgs
): Promise<string> {
  'use step'
  const { agentId, agentName, nowIso } = args

  let systemSandbox: Awaited<ReturnType<typeof getSystemSandbox>>
  try {
    systemSandbox = await getSystemSandbox(agentId)
  } catch (error) {
    if (isMissingSystemSandboxError(error, agentId)) {
      throw nonRetryableStepErrorFromUnknown(
        error,
        `system sandbox unavailable for agent "${agentId}"`
      )
    }
    throw error
  }

  const [agentsMd, identityMd, soulMd, userMd, livePaths] = await Promise.all([
    readLiveMemory(systemSandbox, 'AGENTS.md'),
    readLiveMemory(systemSandbox, 'IDENTITY.md'),
    readLiveMemory(systemSandbox, 'SOUL.md'),
    readLiveMemory(systemSandbox, 'USER.md'),
    listTrackedArchitectureFiles(systemSandbox),
  ])

  const sections: string[] = [
    ...renderHeader({ agentName, nowIso }),
    ...renderEventSections(args.eventKind),
    ...renderBootstrapSections({
      agentsMd,
      eventKind: args.eventKind,
      identityMd,
      soulMd,
      userMd,
    }),
    renderAvailableFiles(livePaths),
  ]

  const reconnectsBlock = renderReconnects(args.reconnects ?? [])
  if (reconnectsBlock) {
    sections.push(reconnectsBlock)
  }

  if (args.hasSkillTools) {
    sections.push(renderAgentSkillsSection())
  }

  sections.push(PLATFORM_INVARIANTS)

  return sections.join('\n\n')
}

function renderHeader(args: { agentName: string; nowIso?: string }): string[] {
  const sections = [`# Agent: ${args.agentName}`]
  if (args.nowIso) {
    sections.push(`Current UTC time: ${args.nowIso}`)
  }
  return sections
}

function renderEventSections(
  eventKind: ComposeSystemPromptArgs['eventKind']
): string[] {
  switch (eventKind) {
    case 'chat':
      return [
        [
          '## Current event',
          '',
          'This is a realtime chat message from the user.',
        ].join('\n'),
        [
          '## Realtime chat behavior',
          '',
          'Respond directly to the user message. Apply AGENTS.md as general',
          'operating context, but ignore heartbeat, dreaming, daily digest,',
          'monitoring, email-summary, and proactive routine sections unless',
          'the user explicitly asks for that work in this chat turn.',
        ].join('\n'),
      ]
    case 'heartbeat':
      return [
        [
          '## Current event',
          '',
          'This is a scheduled or manual heartbeat event.',
        ].join('\n'),
        [
          '## Heartbeat behavior',
          '',
          'Follow the heartbeat kickoff message for this turn. Heartbeats are',
          'short check-ins, not full work sessions: skim, log, finish quick',
          'wins, then stop.',
        ].join('\n'),
      ]
    case 'dreaming':
      return [
        ['## Current event', '', 'This is a dreaming event.'].join('\n'),
        [
          '## Dreaming behavior',
          '',
          'Follow the dreaming kickoff message for this turn. Dreaming passes',
          'are deeper but still bounded reviews. Use logs as evidence, cite',
          'memory paths/line numbers when updating DREAMS.md, and only change',
          'GOALS.md or TASKS.md when the evidence supports it.',
        ].join('\n'),
      ]
    case 'invocation':
      return [
        ['## Current event', '', 'This is a sub-agent run.'].join('\n'),
        [
          '## Sub-agent behavior',
          '',
          'Complete only the delegated task in the user message and return a',
          'concise final answer. Do not run heartbeat, dreaming, monitoring,',
          'email-summary, or other proactive routines unless the delegated task',
          'explicitly asks for them.',
        ].join('\n'),
      ]
    default:
      return [
        [
          '## Current event',
          '',
          'This is an agent event. Follow the immediate user/developer message',
          'for this turn and avoid unrelated proactive routines.',
        ].join('\n'),
      ]
  }
}

function renderBootstrapSections(args: {
  agentsMd: string | null
  eventKind: ComposeSystemPromptArgs['eventKind']
  identityMd: string | null
  soulMd: string | null
  userMd: string | null
}): string[] {
  return [
    renderEagerContext({
      content: args.agentsMd,
      eventKind: args.eventKind,
      heading: 'AGENTS.md (operational manual - read-only, managed by user)',
      path: 'AGENTS.md',
    }),
    renderEagerContext({
      content: args.identityMd,
      eventKind: args.eventKind,
      heading: 'IDENTITY.md (identity card - read-only, managed by user)',
      path: 'IDENTITY.md',
    }),
    renderEagerContext({
      content: args.soulMd,
      eventKind: args.eventKind,
      heading: 'SOUL.md (persona - read-only, managed by user)',
      path: 'SOUL.md',
    }),
    renderEagerContext({
      content: args.userMd,
      eventKind: args.eventKind,
      heading:
        'USER.md (user profile - agent-maintained, update with writeFile)',
      path: 'USER.md',
    }),
  ].filter((section): section is string => section !== null)
}

function renderEagerContext(args: {
  content: string | null
  eventKind: ComposeSystemPromptArgs['eventKind']
  heading: string
  path: string
}): string | null {
  const trimmed = args.content?.trim()
  if (!trimmed) {
    return null
  }

  const content =
    args.path === 'AGENTS.md' && args.eventKind === 'chat'
      ? [
          trimmed,
          '',
          '_Chat event note: heartbeat and dreaming sections above are inactive for this realtime chat unless the user explicitly asks for that routine._',
        ].join('\n')
      : trimmed

  if (content.length <= MAX_EAGER_CONTEXT_CHARS) {
    return `## ${args.heading}\n\n${content}`
  }
  const truncated = content.slice(0, MAX_EAGER_CONTEXT_CHARS).trimEnd()
  return `## ${args.heading}\n\n${truncated}\n\n_[${args.path} truncated to ${MAX_EAGER_CONTEXT_CHARS} characters for this turn.]_`
}

function renderAvailableFiles(paths: string[]): string {
  const otherPaths = paths.filter((p) => !EAGER_CONTEXT_PATH_SET.has(p)).sort()
  if (otherPaths.length > 0) {
    const lines = otherPaths.map((p) => `- ${p}`).join('\n')
    return `## Tracked sandbox files available\n\n${lines}`
  }

  const protectedPaths = Array.from(READ_ONLY_FOR_AGENT).sort().join(', ')
  return `## Tracked sandbox files available\n\n_(none yet - author files with writeFile as you accumulate notes; eager files ${EAGER_CONTEXT_PATHS.join(', ')} are inlined above when present. Protected files ${protectedPaths} cannot be modified by the agent; USER.md can be created or updated with writeFile.)_`
}

function renderReconnects(reconnects: readonly Reconnect[]): string | null {
  if (reconnects.length === 0) {
    return null
  }
  const lines = reconnects.map(reconnectPromptLine).join('\n')
  return [
    '## Tools needing reconnection',
    '',
    'The following maintainer tools are attached but not callable this turn:',
    '',
    lines,
    '',
    'Do not pretend these tools succeeded. If the user asks you to do',
    'something that requires one of them, tell them which connection',
    'needs attention and stop.',
  ].join('\n')
}

function renderAgentSkillsSection(): string {
  return [
    '## Agent Skills',
    '',
    'This agent has installed Agent Skills. Use them when they are present',
    "and useful for the task. Use skill({ skillName }) to load a skill's",
    'instructions before relying on it. Use bash for commands in the Skill',
    'Sandbox only. The system memory sandbox still uses readFile, writeFile,',
    'listFiles, and grepFiles.',
  ].join('\n')
}
