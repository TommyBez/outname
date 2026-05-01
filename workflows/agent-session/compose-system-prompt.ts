import { getSystemSandbox } from '@/lib/agent-sandbox'
import type { Reconnect } from '@/tools/types'
import {
  listLiveMemory,
  readLiveMemory,
} from '@/workflows/agent-session/tools/pending-writes'
import {
  PERSONA_PATHS,
  READ_ONLY_FOR_AGENT,
} from '@/workflows/agent-session/tools/persona-paths'

/**
 * Build the system prompt: inline AGENTS.md + IDENTITY.md + SOUL.md from the
 * system
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
}

const FOOTER = `## Platform invariants

- Your memory volume persists across every event. Use the memory_*
  tools to take notes; anything you write outside the memory volume
  (e.g. via bash/file_write in the exec sandbox) does NOT show up in
  your context next time.
- AGENTS.md, IDENTITY.md, and SOUL.md are user-owned bootstrap files.
  Your memory_* tools will refuse to write or delete them and return a
  structured read_only error. If a change is needed, ask the user to
  make it through the agent settings UI.
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

function describeReconnect(r: Reconnect): string {
  switch (r.reason) {
    case 'connection_unavailable':
      return `- \`${r.toolId}\` (provider: ${r.provider}) — connection is missing or unusable. Ask the user to connect or replace it from settings.`
    case 'config_invalid':
      return `- \`${r.toolId}\` — attached configuration is invalid (${r.message}). Ask the user to re-attach this tool.`
    case 'build_failed':
      return `- \`${r.toolId}\` — failed to initialize (${r.message}). The platform owner has been notified; route around this tool for now.`
    case 'tool_removed':
      return `- \`${r.toolId}\` — this tool no longer exists in the registry. Ask the user to detach it.`
    case 'tool_sandbox_building':
      return `- \`${r.toolId}\` — its tool environment ("${r.manifest}") is still being prepared. Ask the user to retry in a moment; do not pretend the tool ran.`
    case 'tool_sandbox_unavailable':
      return `- \`${r.toolId}\` — its tool environment ("${r.manifest}") is unavailable (${r.message}). Tell the user the tool needs to be re-attached from settings.`
    case 'sub_agent_unavailable':
      return `- \`${r.toolId}\` — sub-agent unavailable (${r.message}).`
    case 'sub_agent_cycle':
      return `- \`${r.toolId}\` — refused to load: would create a sub-agent cycle. Tell the user this delegation is not allowed.`
    case 'sub_agent_depth':
      return `- \`${r.toolId}\` — refused to load: sub-agent nesting limit exceeded. Tell the user the chain is too deep and break the task into fewer levels.`
    default: {
      const _exhaustive: never = r
      return `- (unknown reconnect reason) ${JSON.stringify(_exhaustive)}`
    }
  }
}

function renderReconnects(reconnects: readonly Reconnect[]): string | null {
  if (reconnects.length === 0) {
    return null
  }
  const lines = reconnects.map(describeReconnect).join('\n')
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

export async function composeSystemPrompt(
  args: ComposeSystemPromptArgs
): Promise<string> {
  'use step'
  const { agentId, agentName, nowIso } = args

  const systemSandbox = await getSystemSandbox(agentId)

  const [agentsMd, identityMd, soulMd, livePaths] = await Promise.all([
    readLiveMemory(systemSandbox, 'AGENTS.md'),
    readLiveMemory(systemSandbox, 'IDENTITY.md'),
    readLiveMemory(systemSandbox, 'SOUL.md'),
    listLiveMemory(systemSandbox),
  ])

  const sections: string[] = []

  sections.push(`# Agent: ${agentName}`)
  if (nowIso) {
    sections.push(`Current UTC time: ${nowIso}`)
  }

  if (agentsMd && agentsMd.trim().length > 0) {
    sections.push(
      `## AGENTS.md (operational manual — read-only, managed by user)\n\n${agentsMd.trim()}`
    )
  }
  if (identityMd && identityMd.trim().length > 0) {
    sections.push(
      `## IDENTITY.md (identity card — read-only, managed by user)\n\n${identityMd.trim()}`
    )
  }
  if (soulMd && soulMd.trim().length > 0) {
    sections.push(
      `## SOUL.md (persona — read-only, managed by user)\n\n${soulMd.trim()}`
    )
  }

  const otherPaths = livePaths.filter((p) => !READ_ONLY_FOR_AGENT.has(p)).sort()
  if (otherPaths.length > 0) {
    const lines = otherPaths.map((p) => `- ${p}`).join('\n')
    sections.push(`## Memory files available\n\n${lines}`)
  } else {
    sections.push(
      `## Memory files available\n\n_(none yet — author files with write_memory as you accumulate notes; persona files ${PERSONA_PATHS.join(', ')} are inlined above and cannot be modified by the agent.)_`
    )
  }

  const reconnectsBlock = renderReconnects(args.reconnects ?? [])
  if (reconnectsBlock) {
    sections.push(reconnectsBlock)
  }

  sections.push(FOOTER)

  return sections.join('\n\n')
}
