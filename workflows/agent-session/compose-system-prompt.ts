import { getSystemSandbox } from "@/lib/agent-sandbox"
import {
  listLiveMemory,
  readLiveMemory,
} from "@/workflows/agent-session/tools/pending-writes"
import {
  PERSONA_PATHS,
  READ_ONLY_FOR_AGENT,
} from "@/workflows/agent-session/tools/persona-paths"

/**
 * Build the system prompt: inline AGENTS.md + SOUL.md from the system
 * sandbox, list other memory paths, append platform invariants. Computed
 * once per event; on-disk writes from this turn show up after `endOfEvent`.
 */

export interface ComposeSystemPromptArgs {
  agentId: string
  agentName: string
  /** UTC ISO timestamp embedded so the model knows what "now" is. */
  nowIso?: string
}

const FOOTER = `## Platform invariants

- Your memory volume persists across every event. Use the memory_*
  tools to take notes; anything you write outside the memory volume
  (e.g. via bash/file_write in the exec sandbox) does NOT show up in
  your context next time.
- AGENTS.md and SOUL.md are user-owned identity files. Your memory_*
  tools will refuse to write or delete them and return a structured
  read_only error. If a change is needed, ask the user to make it
  through the agent settings UI.
- Reads in the same turn see your queued memory writes. Writes are
  flushed to disk at end-of-event, then mirrored into the agent files
  UI.
- Prefer doing the smallest correct thing and stopping. Long tool
  loops cost the user money and latency.
- When unsure of a fact about the user, check your memory files
  first; only ask if it's truly missing.
- Heartbeats are short check-ins, not full work sessions. Skim, log,
  finish quick wins, stop.
`

export async function composeSystemPrompt(
  args: ComposeSystemPromptArgs,
): Promise<string> {
  "use step"
  const { agentId, agentName, nowIso } = args

  const systemSandbox = await getSystemSandbox(agentId)

  const [agentsMd, soulMd, livePaths] = await Promise.all([
    readLiveMemory(systemSandbox, "AGENTS.md"),
    readLiveMemory(systemSandbox, "SOUL.md"),
    listLiveMemory(systemSandbox),
  ])

  const sections: string[] = []

  sections.push(`# Agent: ${agentName}`)
  if (nowIso) sections.push(`Current UTC time: ${nowIso}`)

  if (agentsMd && agentsMd.trim().length > 0) {
    sections.push(
      `## AGENTS.md (operational manual — read-only, managed by user)\n\n${agentsMd.trim()}`,
    )
  }
  if (soulMd && soulMd.trim().length > 0) {
    sections.push(
      `## SOUL.md (persona — read-only, managed by user)\n\n${soulMd.trim()}`,
    )
  }

  const otherPaths = livePaths
    .filter((p) => !READ_ONLY_FOR_AGENT.has(p))
    .sort()
  if (otherPaths.length > 0) {
    const lines = otherPaths.map((p) => `- ${p}`).join("\n")
    sections.push(`## Memory files available\n\n${lines}`)
  } else {
    sections.push(
      `## Memory files available\n\n_(none yet — author files with write_memory as you accumulate notes; persona files ${PERSONA_PATHS.join(", ")} are inlined above and cannot be modified by the agent.)_`,
    )
  }

  sections.push(FOOTER)

  return sections.join("\n\n")
}
