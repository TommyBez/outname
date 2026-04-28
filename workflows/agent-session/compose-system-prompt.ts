import type { Sandbox } from "@vercel/sandbox"
import { readLiveMemory } from "@/workflows/agent-session/tools/pending-writes"

/**
 * Stitch together the model's effective system prompt from three
 * layered sources:
 *
 *   1. **User system prompt** (from `agent.system_prompt`) — the
 *      product-level definition of what this agent is for. Authored
 *      by the human via the agent form.
 *
 *   2. **Persona files** read live from the system sandbox:
 *        - `AGENTS.md` — the operational manual the agent itself
 *          maintains. Conventions, tool inventory, file layout.
 *        - `SOUL.md` — the agent's self-model: voice, identity, values.
 *      Both files are agent-managed (the model can rewrite them via
 *      the memory tools), so the prompt re-reads them every event;
 *      a Phase 2 agent that overwrites SOUL.md mid-turn picks up the
 *      new persona on its next event.
 *
 *   3. **Operational footer** — non-negotiable platform invariants:
 *      memory is durable across events, the assistant should prefer
 *      using its tools over guessing, sandboxes have caveats, etc.
 *
 * The order matters. The user prompt comes first because it's the
 * highest-leverage instruction; the persona files come next so they
 * can colour the user prompt without overriding it; the footer is
 * last so platform contracts are the freshest thing in context.
 *
 * Files that don't exist (e.g. a brand-new agent that hasn't authored
 * SOUL.md yet) are simply omitted from the composed prompt — no
 * placeholder text, so the model isn't tempted to copy literal `(none
 * yet)` strings into its output.
 */

export interface ComposeSystemPromptArgs {
  agentName: string
  /** Verbatim from `agent.system_prompt`. */
  userSystemPrompt: string
  /** Live system sandbox. The compose step reads AGENTS.md + SOUL.md from here. */
  systemSandbox: Sandbox
  /** UTC ISO timestamp embedded in the footer so the model knows what "now" is. */
  nowIso?: string
}

const FOOTER = `## Platform invariants

- Your memory volume persists across every event. Use the memory_*
  tools to take notes; anything you write outside the memory volume
  (e.g. via bash/file_write in the exec sandbox) does NOT show up in
  your AGENTS.md context next time.
- Reads in the same turn see your queued memory writes. Writes are
  flushed to disk at end-of-event, then mirrored into the UI.
- Prefer doing the smallest correct thing and stopping. Long tool
  loops cost the user money and latency.
- When unsure of a fact about the user, check MEMORY.md first; only
  ask if it's truly missing.
- Heartbeats are short check-ins, not full work sessions. Skim, log,
  finish quick wins, stop.
`

export async function composeSystemPrompt(
  args: ComposeSystemPromptArgs,
): Promise<string> {
  const { agentName, userSystemPrompt, systemSandbox, nowIso } = args

  const [agentsMd, soulMd] = await Promise.all([
    readLiveMemory(systemSandbox, "AGENTS.md"),
    readLiveMemory(systemSandbox, "SOUL.md"),
  ])

  const sections: string[] = []

  sections.push(`# Agent: ${agentName}`)
  if (nowIso) sections.push(`Current UTC time: ${nowIso}`)

  // 1. User-defined purpose.
  const trimmedPrompt = userSystemPrompt.trim()
  if (trimmedPrompt.length > 0) {
    sections.push(`## Purpose\n\n${trimmedPrompt}`)
  }

  // 2. Persona files. Headings labelled so the model knows what it's
  // looking at; bodies are the file content verbatim.
  if (agentsMd && agentsMd.trim().length > 0) {
    sections.push(`## AGENTS.md (your operational manual)\n\n${agentsMd.trim()}`)
  }
  if (soulMd && soulMd.trim().length > 0) {
    sections.push(`## SOUL.md (your persona)\n\n${soulMd.trim()}`)
  }

  // 3. Footer.
  sections.push(FOOTER)

  return sections.join("\n\n")
}
