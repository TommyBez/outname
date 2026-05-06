import { getSystemSandbox } from '@/lib/agent-sandbox'
import { reconnectPromptLine } from '@/tools/reconnect-renderer'
import type { Reconnect } from '@/tools/types'
import {
  listLiveMemory,
  readLiveMemory,
} from '@/workflows/agent-session/tools/pending-writes'
import {
  EAGER_CONTEXT_PATHS,
  READ_ONLY_FOR_AGENT,
} from '@/workflows/agent-session/tools/persona-paths'

/**
 * Build the system prompt: inline eager context files from the system
 * sandbox, list other memory paths, append platform invariants. Computed
 * once per event; on-disk writes from this turn show up after `endOfEvent`.
 */

export interface ComposeSystemPromptArgs {
  agentId: string
  agentName: string
  /** UTC ISO timestamp embedded so the model knows what "now" is. */
  nowIso?: string
  /**
   * Tools that failed to materialize this event. Surfaced verbatim so
   * the model can either route around them or tell the user to
   * reconnect.
   */
  reconnects?: readonly Reconnect[]
  /**
   * Optional `SKILL DIRECTORIES` block produced by `createSkillTools`.
   * Inlined into the prompt so the model can see what skill paths are
   * available before it chooses to call the `skill` tool.
   */
  skillInstructions?: string
}

const FOOTER = `## Platform invariants

- Your memory volume persists across every event. Use the memory_*
  tools to take notes; anything you write outside the memory volume
  (e.g. via bash/file_write in the exec sandbox) does NOT show up in
  your context next time.
- AGENTS.md and SOUL.md are user-owned bootstrap files. Your memory_*
  tools will refuse to write or delete them and return a structured
  read_only error. If a change is needed, ask the user to make it
  through the agent settings UI.
- IDENTITY.md is also a user-owned bootstrap file. Your memory_* tools
  will refuse to write or delete it; ask the user to edit it through
  the agent settings UI.
- USER.md is an eager user profile file when present. You may create
  or update it with memory tools when conversations reveal durable
  user preferences, identity, goals, or hard boundaries.
- Reads in the same turn see your queued memory writes. Writes are
  flushed to disk at end-of-event, then mirrored into the agent files
  UI.
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
    listLiveMemory(systemSandbox),
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
        'USER.md (user profile — agent-maintained, update with memory tools)',
      path: 'USER.md',
    }),
  ].filter((section): section is string => section !== null)
  sections.push(...eagerSections)

  const otherPaths = livePaths
    .filter((p) => !EAGER_CONTEXT_PATH_SET.has(p))
    .sort()
  if (otherPaths.length > 0) {
    const lines = otherPaths.map((p) => `- ${p}`).join('\n')
    sections.push(`## Memory files available\n\n${lines}`)
  } else {
    const protectedPaths = Array.from(READ_ONLY_FOR_AGENT).sort().join(', ')
    sections.push(
      `## Memory files available\n\n_(none yet — author files with write_memory as you accumulate notes; eager files ${EAGER_CONTEXT_PATHS.join(', ')} are inlined above when present. Protected files ${protectedPaths} cannot be modified by the agent; USER.md can be created or updated with memory tools.)_`
    )
  }

  const reconnectsBlock = renderReconnects(args.reconnects ?? [])
  if (reconnectsBlock) {
    sections.push(reconnectsBlock)
  }

  const skillBlock = args.skillInstructions?.trim()
  if (skillBlock) {
    sections.push(`## Agent skills\n\n${skillBlock}`)
  }

  sections.push(FOOTER)

  return sections.join('\n\n')
}
