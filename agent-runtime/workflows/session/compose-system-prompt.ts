import { getSystemSandbox } from '@/agent-runtime/server/agent-sandbox'
import {
  EAGER_CONTEXT_PATHS,
  READ_ONLY_FOR_AGENT,
} from '@/agent-runtime/workflows/session/tools/persona-paths'
import { listTrackedArchitectureFiles } from '@/agent-runtime/workflows/session/tools/sandbox-file-helpers/list'
import { readLiveMemory } from '@/agent-runtime/workflows/session/tools/sandbox-file-helpers/read'
import type { Reconnect } from '@/tools/catalog/types'
import { reconnectPromptLine } from '@/tools/runtime/reconnect-renderer'

export interface ComposeSystemPromptArgs {
  agentId: string
  agentName: string
  nowIso?: string
  reconnects?: readonly Reconnect[]
}

const FOOTER = `## Platform invariants

- Your persistent system sandbox is rooted at /vercel/sandbox. Use
  readFile, writeFile, listFiles, and grepFiles for durable file work.
  Direct bash execution is not available.
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
- End-of-event mirrors only architecture-defined files to the agent
  files UI: AGENTS.md, IDENTITY.md, SOUL.md, USER.md, MEMORY.md,
  TASKS.md, CALENDAR.md, GOALS.md, DREAMS.md, and logs/*.md.
  Arbitrary sandbox files persist but are not inserted into the UI DB
  mirrors or review-change table.
- Prefer doing the smallest correct thing and stopping. Long tool
  loops cost the user money and latency.
- When unsure of a fact about the user, check your memory files
  first; only ask if it's truly missing.
- Heartbeats are short check-ins, not full work sessions. Skim, log,
  finish quick wins, stop.
- Reflection passes are deeper but still bounded reviews. Use logs as
  evidence, cite memory paths/line numbers when updating DREAMS.md, and
  only change GOALS.md or TASKS.md when the evidence supports it.
`

const MAX_EAGER_CONTEXT_CHARS = 12_000
const EAGER_CONTEXT_PATH_SET: ReadonlySet<string> = new Set(EAGER_CONTEXT_PATHS)

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

function renderEagerContext(args: {
  content: string | null
  heading: string
  path: string
}): string | null {
  const trimmed = args.content?.trim()
  if (!trimmed) {
    return null
  }
  if (trimmed.length <= MAX_EAGER_CONTEXT_CHARS) {
    return `## ${args.heading}\n\n${trimmed}`
  }
  const truncated = trimmed.slice(0, MAX_EAGER_CONTEXT_CHARS).trimEnd()
  return `## ${args.heading}\n\n${truncated}\n\n_[${args.path} truncated to ${MAX_EAGER_CONTEXT_CHARS} characters for this turn.]_`
}

export async function composeSystemPrompt(
  args: ComposeSystemPromptArgs
): Promise<string> {
  'use step'
  const { agentId, agentName, nowIso } = args

  const systemSandbox = await getSystemSandbox(agentId)

  const [agentsMd, identityMd, soulMd, userMd, livePaths] = await Promise.all([
    readLiveMemory(systemSandbox, 'AGENTS.md'),
    readLiveMemory(systemSandbox, 'IDENTITY.md'),
    readLiveMemory(systemSandbox, 'SOUL.md'),
    readLiveMemory(systemSandbox, 'USER.md'),
    listTrackedArchitectureFiles(systemSandbox),
  ])

  const sections: string[] = []

  sections.push(`# Agent: ${agentName}`)
  if (nowIso) {
    sections.push(`Current UTC time: ${nowIso}`)
  }

  const eagerSections = [
    renderEagerContext({
      content: agentsMd,
      heading: 'AGENTS.md (operational manual — read-only, managed by user)',
      path: 'AGENTS.md',
    }),
    renderEagerContext({
      content: identityMd,
      heading: 'IDENTITY.md (identity card — read-only, managed by user)',
      path: 'IDENTITY.md',
    }),
    renderEagerContext({
      content: soulMd,
      heading: 'SOUL.md (persona — read-only, managed by user)',
      path: 'SOUL.md',
    }),
    renderEagerContext({
      content: userMd,
      heading:
        'USER.md (user profile — agent-maintained, update with writeFile)',
      path: 'USER.md',
    }),
  ].filter((section): section is string => section !== null)
  sections.push(...eagerSections)

  const otherPaths = livePaths
    .filter((p) => !EAGER_CONTEXT_PATH_SET.has(p))
    .sort()
  if (otherPaths.length > 0) {
    const lines = otherPaths.map((p) => `- ${p}`).join('\n')
    sections.push(`## Tracked sandbox files available\n\n${lines}`)
  } else {
    const protectedPaths = Array.from(READ_ONLY_FOR_AGENT).sort().join(', ')
    sections.push(
      `## Tracked sandbox files available\n\n_(none yet — author files with writeFile as you accumulate notes; eager files ${EAGER_CONTEXT_PATHS.join(', ')} are inlined above when present. Protected files ${protectedPaths} cannot be modified by the agent; USER.md can be created or updated with writeFile.)_`
    )
  }

  const reconnectsBlock = renderReconnects(args.reconnects ?? [])
  if (reconnectsBlock) {
    sections.push(reconnectsBlock)
  }

  sections.push(FOOTER)

  return sections.join('\n\n')
}
