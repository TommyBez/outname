// The "built on primitives" grid mirrors how vercel.com/eve leans on its
// underlying platform. outname is open-source and self-hostable, so the value
// here is "trusted, swappable building blocks" rather than lock-in.

export interface PlatformPrimitive {
  id: string
  /** Optional secondary line, e.g. interchangeable providers. */
  meta?: string
  name: string
  role: string
}

export const platformPrimitives: readonly PlatformPrimitive[] = [
  {
    id: 'next',
    name: 'Next.js 16',
    role: 'A single control plane orchestrates agents, chat, and configuration.',
  },
  {
    id: 'workflow',
    name: 'Vercel Workflow',
    role: 'Durable, event-driven runs for heartbeat, dreaming, and sub-agents.',
  },
  {
    id: 'sandbox',
    name: 'Vercel Sandbox',
    role: "Each agent's persistent filesystem and isolated skill execution.",
  },
  {
    id: 'inference',
    meta: 'LLM Gateway · OpenRouter',
    name: 'AI Gateway',
    role: 'Model-agnostic inference. Bring your own provider and keys.',
  },
  {
    id: 'neon',
    name: 'Neon Postgres',
    role: 'The control-plane database, typed end to end with Drizzle.',
  },
  {
    id: 'upstash',
    name: 'Upstash Redis',
    role: 'Coordination, caching, and per-agent rate limits.',
  },
  {
    id: 'auth',
    name: 'Better Auth',
    role: 'Passwordless sign-in with email one-time codes.',
  },
  {
    id: 'chat-sdk',
    name: 'Vercel Chat SDK',
    role: 'Slack and in-app chat — one agent across every surface.',
  },
]
