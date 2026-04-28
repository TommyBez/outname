/**
 * Persona file ownership policy — single source of truth.
 *
 * Per ARCHITECTURE.md §3 (Tool) and §4.2 (Sandbox):
 *
 *   - `AGENTS.md` is seeded by the system on first sandbox boot with a
 *     baseline template (`seedAgentsMd`). The user can later customize
 *     it via the pending-writes queue.
 *   - `SOUL.md` is purely user-authored. The agent has no path to
 *     create it; it appears only when the operator writes one (Phase 2
 *     does this via direct DB upsert; Phase 3 adds a UI editor).
 *
 * The agent itself MUST NOT modify either file at runtime. Centralising
 * the set in one module guarantees `memory_write`, `memory_edit`, and
 * `memory_delete` cannot drift.
 */
export const PERSONA_PATHS = ["AGENTS.md", "SOUL.md"] as const

export type PersonaPath = (typeof PERSONA_PATHS)[number]

/**
 * Set of paths the agent's memory tools MUST refuse to mutate. The
 * tool returns a structured `{ error: "read_only", ... }` result so
 * the model can react in its reply rather than crash mid-stream.
 */
export const READ_ONLY_FOR_AGENT: ReadonlySet<string> = new Set(PERSONA_PATHS)

export function isReadOnlyForAgent(path: string): boolean {
  return READ_ONLY_FOR_AGENT.has(path)
}

/**
 * Stable structured error every memory tool returns when asked to
 * mutate a persona file. Structured rather than thrown so:
 *   1. The model receives a tool result it can quote / react to in
 *      the same turn (a thrown step error would surface as a generic
 *      stream failure).
 *   2. Downstream observers (chat UI, future audit log) can recognise
 *      the canonical reason without parsing prose.
 */
export const READ_ONLY_TOOL_ERROR = {
  error: "read_only" as const,
  message:
    "SOUL.md and AGENTS.md are user-owned identity files. The agent cannot modify them; ask the user to edit them via the agent settings UI.",
}
