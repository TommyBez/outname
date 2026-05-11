// USER.md is eager but agent-writable; the other eager context files are
// bootstrap files that must stay read-only for the agent.
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

export const READ_ONLY_FOR_AGENT: ReadonlySet<string> = new Set(
  PROTECTED_CONTEXT_PATHS
)

export function isReadOnlyForAgent(path: string): boolean {
  return READ_ONLY_FOR_AGENT.has(path)
}

// Keep this structured error stable for older callers and UI copy.
export const READ_ONLY_TOOL_ERROR = {
  error: 'read_only' as const,
  message:
    'AGENTS.md, IDENTITY.md, and SOUL.md are protected bootstrap files. The agent cannot modify them; ask the user to edit them via the agent settings UI.',
}
