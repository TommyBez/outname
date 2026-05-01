/**
 * Eager context + protected-file policy — single source of truth.
 *
 * `AGENTS.md`, `IDENTITY.md`, `SOUL.md`, and `USER.md` are injected
 * into the system prompt when present.
 *
 *   - `AGENTS.md` is seeded by the system on first sandbox boot with a
 *     baseline template and later customized via pending writes.
 *   - `IDENTITY.md` is a compact user-authored identity card. The seed
 *     step bootstraps an empty file so every sandbox has a stable place
 *     for it.
 *   - `SOUL.md` is a deeper user-authored persona file.
 *   - `USER.md` is an eager user profile that the agent may create and
 *     refine as conversations reveal durable facts about the human it
 *     serves.
 *
 * The agent itself MUST NOT modify `AGENTS.md`, `IDENTITY.md`, or
 * `SOUL.md` at runtime. Centralising the sets in one module guarantees
 * `write_memory`, `edit_memory`, and `delete_memory` cannot drift.
 */
export const EAGER_CONTEXT_PATHS = [
  'AGENTS.md',
  'IDENTITY.md',
  'SOUL.md',
  'USER.md',
] as const

export type EagerContextPath = (typeof EAGER_CONTEXT_PATHS)[number]

export const PROTECTED_CONTEXT_PATHS = [
  'AGENTS.md',
  'IDENTITY.md',
  'SOUL.md',
] as const

export type ProtectedContextPath = (typeof PROTECTED_CONTEXT_PATHS)[number]

/**
 * Set of paths the agent's memory tools MUST refuse to mutate. The
 * tool returns a structured `{ error: "read_only", ... }` result so
 * the model can react in its reply rather than crash mid-stream.
 */
export const READ_ONLY_FOR_AGENT: ReadonlySet<string> = new Set(
  PROTECTED_CONTEXT_PATHS
)

export function isReadOnlyForAgent(path: string): boolean {
  return READ_ONLY_FOR_AGENT.has(path)
}

/**
 * Stable structured error every memory tool returns when asked to
 * mutate a protected context file. Structured rather than thrown so:
 *   1. The model receives a tool result it can quote / react to in
 *      the same turn (a thrown step error would surface as a generic
 *      stream failure).
 *   2. Downstream observers (chat UI, future audit log) can recognise
 *      the canonical reason without parsing prose.
 */
export const READ_ONLY_TOOL_ERROR = {
  error: 'read_only' as const,
  message:
    'AGENTS.md, IDENTITY.md, and SOUL.md are protected bootstrap files. The agent cannot modify them; ask the user to edit them via the agent settings UI.',
}
