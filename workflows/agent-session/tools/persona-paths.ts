/**
 * Eager context + protected-file policy — single source of truth.
 *
 * `AGENTS.md`, `SOUL.md`, and `USER.md` are injected into the system
 * prompt when present, but only AGENTS/SOUL are protected from agent
 * writes. `USER.md` is agent-maintained: the model should create and
 * refine it as conversations reveal stable user-profile facts.
 */
export const EAGER_CONTEXT_PATHS = ['AGENTS.md', 'SOUL.md', 'USER.md'] as const

export type EagerContextPath = (typeof EAGER_CONTEXT_PATHS)[number]

export const PROTECTED_CONTEXT_PATHS = ['AGENTS.md', 'SOUL.md'] as const

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
    'SOUL.md and AGENTS.md are protected bootstrap files. The agent cannot modify them; ask the user to edit them via the agent settings UI.',
}
