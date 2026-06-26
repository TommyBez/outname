// "Built on primitives" mirrors eve's "Leverages all Vercel AI primitives":
// a row of category cards, each listing the real products behind it, plus a
// channels/connectors block. Everything here is real to the outname stack.

export interface PrimitiveProduct {
  name: string
  role: string
}

export interface PrimitiveCard {
  eyebrow: string
  id: string
  products: readonly PrimitiveProduct[]
  summary: string
}

export const primitiveCards: readonly PrimitiveCard[] = [
  {
    eyebrow: 'Runtime',
    id: 'runtime',
    products: [
      {
        name: 'Vercel Workflow',
        role: 'Heartbeat, dreaming, and sub-agent runs — checkpointed and resumable.',
      },
    ],
    summary: 'Durable, event-driven execution.',
  },
  {
    eyebrow: 'Compute',
    id: 'compute',
    products: [
      {
        name: 'Vercel Sandbox',
        role: 'A persistent, isolated filesystem and skill execution per agent.',
      },
    ],
    summary: 'A filesystem of its own.',
  },
  {
    eyebrow: 'Inference',
    id: 'inference',
    products: [
      {
        name: 'Vercel AI Gateway',
        role: 'Default gateway for model calls and streaming.',
      },
      { name: 'LLM Gateway', role: 'Alternate provider, same interface.' },
      { name: 'OpenRouter', role: 'Hundreds of models behind one key.' },
    ],
    summary: 'Model-agnostic. Bring your own keys.',
  },
  {
    eyebrow: 'Foundation',
    id: 'foundation',
    products: [
      { name: 'Next.js 16', role: 'The single control plane.' },
      {
        name: 'Neon Postgres',
        role: 'Typed control-plane database via Drizzle.',
      },
      {
        name: 'Upstash Redis',
        role: 'Coordination, caching, and rate limits.',
      },
      { name: 'Better Auth', role: 'Passwordless email one-time codes.' },
    ],
    summary: 'Control plane, data, and sign-in.',
  },
]

export const channelsCard = {
  connectors: [
    'GitHub',
    'Cal.com',
    'Resend',
    'Firecrawl',
    'PostHog',
    'Parallel',
    'Typefully',
    'X',
    'Supabase',
    'v0',
    'Vercel',
    'Context7',
  ],
  eyebrow: 'Channels & connectors',
  product: {
    name: 'Vercel Chat SDK',
    role: 'In-app chat and Slack today; new surfaces drop in on the same agent.',
  },
  surfaces: ['in-app chat', 'Slack'],
  summary: 'One agent, every surface.',
} as const
