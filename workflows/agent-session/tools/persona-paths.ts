/**
 * Persona file ownership policy — single source of truth.
 *
 * Per ARCHITECTURE.md §3 (Tool) and §4.2 (Sandbox):
 *
 *   - `AGENTS.md` is seeded by the system on first sandbox boot with a
 *     baseline template (`seedAgentsMd`). The user can later customize
 *     it via the pending-writes queue.
 *   - `IDENTITY.md` is a compact user-authored identity card. The seed
 *     step bootstraps an empty file so every sandbox has a stable place
 *     for it.
 *   - `SOUL.md` is a deeper user-authored persona file. It appears only
 *     when the operator writes one.
 *
 * The agent itself MUST NOT modify any of these files at runtime.
 * Centralising the set in one module guarantees `write_memory`,
 * `edit_memory`, and `delete_memory` cannot drift.
 */
export const PERSONA_PATHS = ['IDENTITY.md', 'SOUL.md', 'AGENTS.md'] as const

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
  error: 'read_only' as const,
  message:
    'IDENTITY.md, SOUL.md, and AGENTS.md are user-owned bootstrap files. The agent cannot modify them; ask the user to edit them via the agent settings UI.',
}
