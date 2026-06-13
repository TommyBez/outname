import { PRODUCT_HUNT_LAUNCH } from '@outname/shared/launch/product-hunt'

export type ProductHuntSocialPlatform = 'linkedin' | 'x'

export interface ProductHuntSocialPost {
  assetPath: string
  id: string
  notAfterIso: string
  platform: ProductHuntSocialPlatform
  publishAtIso: string
  requiresProductHuntUrl: boolean
  text: string
}

const PUBLIC_ASSET_ROOT = '/product-hunt-vercel-day'

export const PRODUCT_HUNT_SOCIAL_POSTS = [
  {
    assetPath: `${PUBLIC_ASSET_ROOT}/02-vercel-stack.png`,
    id: '2026-06-13-vercel-day-prelaunch-x',
    notAfterIso: '2026-06-14T07:00:00.000Z',
    platform: 'x',
    publishAtIso: '2026-06-13T16:00:00.000Z',
    requiresProductHuntUrl: false,
    text: `OUTNA.ME is launching on Product Hunt for Vercel Day on Tuesday.

The fit is literal:

- Vercel Sandbox for isolated agent state
- Vercel Workflow for durable runs
- AI SDK for model/tool work
- Chat SDK for product surfaces

I am collecting feedback here:
https://outna.me/product-hunt?utm_source=x&utm_medium=social&utm_campaign=${PRODUCT_HUNT_LAUNCH.campaign}&utm_content=2026-06-13-vercel-day-prelaunch`,
  },
  {
    assetPath: `${PUBLIC_ASSET_ROOT}/02-vercel-stack.png`,
    id: '2026-06-13-vercel-day-prelaunch-linkedin',
    notAfterIso: '2026-06-14T07:00:00.000Z',
    platform: 'linkedin',
    publishAtIso: '2026-06-13T16:10:00.000Z',
    requiresProductHuntUrl: false,
    text: `OUTNA.ME is launching on Product Hunt for Vercel Day this Tuesday.

The product is a hosted personal AI agent runtime: memory, schedules, tools, sub-agents, channels, and sandboxed execution.

The Vercel angle is not a badge. It is the runtime architecture:

- Vercel Sandbox for isolated agent work
- Vercel Workflow for durable execution
- AI SDK for model and tool calls
- Chat SDK for product and channel surfaces

I am using the launch to get blunt feedback on positioning and first-use agents.

Launch landing page:
https://outna.me/product-hunt?utm_source=linkedin&utm_medium=social&utm_campaign=${PRODUCT_HUNT_LAUNCH.campaign}&utm_content=2026-06-13-vercel-day-prelaunch`,
  },
  {
    assetPath: `${PUBLIC_ASSET_ROOT}/01-outname-hero.png`,
    id: '2026-06-15-tomorrow-reminder-x',
    notAfterIso: PRODUCT_HUNT_LAUNCH.launchStartIso,
    platform: 'x',
    publishAtIso: '2026-06-15T09:30:00.000Z',
    requiresProductHuntUrl: false,
    text: `OUTNA.ME launches tomorrow on Product Hunt for Vercel Day.

The question I care about most:

What recurring work would you actually trust a small personal agent to keep moving without a fresh prompt?

Landing page:
https://outna.me/product-hunt?utm_source=x&utm_medium=social&utm_campaign=${PRODUCT_HUNT_LAUNCH.campaign}&utm_content=2026-06-15-tomorrow-reminder`,
  },
  {
    assetPath: `${PUBLIC_ASSET_ROOT}/01-outname-hero.png`,
    id: '2026-06-15-tomorrow-reminder-linkedin',
    notAfterIso: PRODUCT_HUNT_LAUNCH.launchStartIso,
    platform: 'linkedin',
    publishAtIso: '2026-06-15T09:40:00.000Z',
    requiresProductHuntUrl: false,
    text: `Tomorrow OUTNA.ME launches on Product Hunt for Vercel Day.

I am not optimizing for a vague AI demo. The product argument is specific:

A useful personal agent is not one big assistant. It is a small operational unit with memory, a schedule, tools, channels, and a clear job.

The landing page is ready here:
https://outna.me/product-hunt?utm_source=linkedin&utm_medium=social&utm_campaign=${PRODUCT_HUNT_LAUNCH.campaign}&utm_content=2026-06-15-tomorrow-reminder

Tomorrow I would value comments and criticism on the positioning.`,
  },
  {
    assetPath: `${PUBLIC_ASSET_ROOT}/02-vercel-stack.png`,
    id: '2026-06-16-live-now-x',
    notAfterIso: '2026-06-16T20:00:00.000Z',
    platform: 'x',
    publishAtIso: '2026-06-16T07:10:00.000Z',
    requiresProductHuntUrl: true,
    text: `OUTNA.ME is live on Product Hunt for Vercel Day.

Built with Vercel Sandbox, Workflow, AI SDK, and Chat SDK.

Would value honest feedback on the positioning and what first agent you would create:
{{PRODUCT_HUNT_URL}}`,
  },
  {
    assetPath: `${PUBLIC_ASSET_ROOT}/02-vercel-stack.png`,
    id: '2026-06-16-live-now-linkedin',
    notAfterIso: '2026-06-16T20:00:00.000Z',
    platform: 'linkedin',
    publishAtIso: '2026-06-16T07:20:00.000Z',
    requiresProductHuntUrl: true,
    text: `OUTNA.ME is live on Product Hunt for Vercel Day.

It is a hosted personal AI agent runtime: memory, schedules, tools, sub-agents, channels, and sandboxed execution.

The launch is tagged Vercel Day because the product uses Vercel primitives directly:

- Sandbox for isolated agent state
- Workflow for durable runs
- AI SDK for model/tool work
- Chat SDK for product surfaces

I would appreciate specific feedback or questions on the Product Hunt page:
{{PRODUCT_HUNT_URL}}`,
  },
  {
    assetPath: `${PUBLIC_ASSET_ROOT}/03-agent-runtime.png`,
    id: '2026-06-16-midday-feedback-x',
    notAfterIso: '2026-06-16T21:00:00.000Z',
    platform: 'x',
    publishAtIso: '2026-06-16T15:00:00.000Z',
    requiresProductHuntUrl: true,
    text: `Midday Product Hunt ask for OUTNA.ME:

Not support. Feedback.

1. Is the hosted agent runtime positioning clear?
2. Does the Vercel stack make the product more credible?
3. What first agent would you create?

{{PRODUCT_HUNT_URL}}`,
  },
  {
    assetPath: `${PUBLIC_ASSET_ROOT}/03-agent-runtime.png`,
    id: '2026-06-17-recap-x',
    notAfterIso: '2026-06-18T07:00:00.000Z',
    platform: 'x',
    publishAtIso: '2026-06-17T09:00:00.000Z',
    requiresProductHuntUrl: true,
    text: `Quick OUTNA.ME Product Hunt follow-up:

The useful part was seeing which pieces people questioned first: trust, first agent use case, and how much autonomy should be default.

That is exactly the feedback loop I wanted.

Launch thread:
{{PRODUCT_HUNT_URL}}`,
  },
  {
    assetPath: `${PUBLIC_ASSET_ROOT}/03-agent-runtime.png`,
    id: '2026-06-17-recap-linkedin',
    notAfterIso: '2026-06-18T07:00:00.000Z',
    platform: 'linkedin',
    publishAtIso: '2026-06-17T09:10:00.000Z',
    requiresProductHuntUrl: true,
    text: `A short OUTNA.ME Product Hunt follow-up.

The most useful launch feedback was not generic support. It was the practical tension around autonomous agents:

- what should run without asking?
- what should wait for approval?
- what memory should be explicit?
- what first agent is narrow enough to trust?

That is the right shape of feedback for an early product.

Launch thread:
{{PRODUCT_HUNT_URL}}`,
  },
] as const satisfies readonly ProductHuntSocialPost[]

export function renderProductHuntSocialText(input: {
  post: ProductHuntSocialPost
  productHuntUrl: string | null
}): string {
  return input.post.text.replaceAll(
    '{{PRODUCT_HUNT_URL}}',
    input.productHuntUrl ?? ''
  )
}
