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
 * Stitch together the model's effective system prompt from three
 * layered sources, in order:
 *
 *   1. **Persona files** read live from the system sandbox:
 *        - `AGENTS.md` — operational manual / instructions. Seeded
 *          on first sandbox boot with a default template, then
 *          edited via the agent settings "Instructions" tab. The
 *          agent's memory_* tools refuse to mutate it.
 *        - `SOUL.md`   — the agent's identity / voice. Purely
 *          user-authored via the agent settings "Identity" tab;
 *          missing on a fresh agent until an operator writes one.
 *      Both files are inlined verbatim so the model sees the same
 *      content the user sees in the agent files UI. Phase 2 dropped
 *      the legacy `agent.system_prompt` column — these two files
 *      are the single source of agent personality.
 *
 *   2. **Memory inventory footer** — the relative paths of every
 *      other `*.md` file the system sandbox holds, so the model can
 *      plan `read_memory` calls without having to probe the listing
 *      itself. Persona files are filtered out (their content is
 *      already inlined above).
 *
 *   3. **Platform invariants** — non-negotiable platform contracts:
 *      memory durability, persona files being read-only at the tool
 *      layer, prefer-tools-over-guesses, heartbeat budgeting.
 *
 * The composed prompt is computed once per event, before
 * `agent.stream`, and never recomposed mid-turn — pending writes from
 * the same event are reflected on the next event after `endOfEvent`
 * flushes them.
 */

export interface ComposeSystemPromptArgs {
  /**
   * The agent whose system sandbox should be resumed inside this
   * step. Keep the live Sandbox handle out of workflow-body inputs.
   */
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

  // 1. Persona files (inlined, content verbatim). Heading copy notes
  // they are user-managed so the model has explicit context for the
  // read_only error if it ever tries to write them.
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

  // 2. Memory inventory footer — list every non-persona *.md path.
  // The model can pull any of them with read_memory.
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

  // 3. Footer.
  sections.push(FOOTER)

  return sections.join("\n\n")
}
