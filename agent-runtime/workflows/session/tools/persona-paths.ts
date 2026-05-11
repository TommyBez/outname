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
 * the model-facing file tools and DB mirroring policy cannot drift.
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
 * Set of paths the agent's file tools MUST refuse to mutate.
 */
export const READ_ONLY_FOR_AGENT: ReadonlySet<string> = new Set(
  PROTECTED_CONTEXT_PATHS
)

export function isReadOnlyForAgent(path: string): boolean {
  return READ_ONLY_FOR_AGENT.has(path)
}

/**
 * Stable structured error kept for older callers and UI copy.
 */
export const READ_ONLY_TOOL_ERROR = {
  error: 'read_only' as const,
  message:
    'AGENTS.md, IDENTITY.md, and SOUL.md are protected bootstrap files. The agent cannot modify them; ask the user to edit them via the agent settings UI.',
}
