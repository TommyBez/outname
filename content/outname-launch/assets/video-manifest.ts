export type LaunchVideoAspect = '16x9' | '4x5' | '1x1'
export type LaunchVideoPlatform = 'x' | 'linkedin' | 'cross-post'

export interface LaunchVideoVariant {
  aspect: LaunchVideoAspect
  compositionId: string
  height: number
  outputPath: string
  platformUsage: LaunchVideoPlatform
  stillPath: string
  width: number
}

export interface LaunchVideoAsset {
  description: string
  durationInFrames: number
  linkedPosts: readonly string[]
  slug: string
  title: string
  variants: readonly LaunchVideoVariant[]
}

const FPS_18_SECONDS = 540
const FPS_20_SECONDS = 600
const FPS_26_SECONDS = 780

function buildVariant(
  slug: string,
  aspect: LaunchVideoAspect,
  platformUsage: LaunchVideoPlatform
): LaunchVideoVariant {
  const dimensions = getDimensions(aspect)

  return {
    aspect,
    compositionId: `${slug}-${aspect}`,
    height: dimensions.height,
    outputPath: `content/outname-launch/assets/videos/${slug}-${aspect}.mp4`,
    platformUsage,
    stillPath: `content/outname-launch/assets/stills/${slug}-${aspect}.png`,
    width: dimensions.width,
  }
}

function getDimensions(aspect: LaunchVideoAspect) {
  if (aspect === '16x9') {
    return { height: 1080, width: 1920 } as const
  }

  if (aspect === '4x5') {
    return { height: 1350, width: 1080 } as const
  }

  return { height: 1080, width: 1080 } as const
}

export const launchVideoManifest = [
  {
    description:
      'Editorial video about repeating context and needing autonomous agents that return to the work over time.',
    durationInFrames: FPS_26_SECONDS,
    linkedPosts: [
      'content/outname-launch/LinkedIn/2026-05-18_10-30.md',
      'content/outname-launch/X/2026-05-18_15-30.md',
    ],
    slug: '2026-05-18-why-outname-exists',
    title: 'Why OUTNA.ME exists',
    variants: [
      buildVariant('2026-05-18-why-outname-exists', '4x5', 'linkedin'),
      buildVariant('2026-05-18-why-outname-exists', '1x1', 'x'),
    ],
  },
  {
    description:
      'Feature video showing agents as configurable units with model, identity, schedule, and memory scope.',
    durationInFrames: FPS_20_SECONDS,
    linkedPosts: [
      'content/outname-launch/LinkedIn/2026-05-20_10-30.md',
      'content/outname-launch/X/2026-05-19_15-30.md',
    ],
    slug: '2026-05-20-agent-configuration',
    title: 'Agent configuration',
    variants: [
      buildVariant('2026-05-20-agent-configuration', '4x5', 'linkedin'),
      buildVariant('2026-05-20-agent-configuration', '1x1', 'x'),
    ],
  },
  {
    description:
      'Feature video showing an autonomous run that starts from a schedule, checks the day, finds follow-ups, sends a brief, and updates memory.',
    durationInFrames: FPS_18_SECONDS,
    linkedPosts: [
      'content/outname-launch/LinkedIn/2026-05-22_10-30.md',
      'content/outname-launch/X/2026-05-22_15-30.md',
      'content/outname-launch/X/2026-05-29_15-30.md',
    ],
    slug: '2026-05-22-autonomous-run',
    title: 'Autonomous run',
    variants: [
      buildVariant('2026-05-22-autonomous-run', '16x9', 'x'),
      buildVariant('2026-05-22-autonomous-run', '4x5', 'linkedin'),
      buildVariant('2026-05-22-autonomous-run', '1x1', 'cross-post'),
    ],
  },
  {
    description:
      'Feature video about memory as a way for agents to adapt after repeated runs.',
    durationInFrames: FPS_18_SECONDS,
    linkedPosts: [
      'content/outname-launch/LinkedIn/2026-05-26_10-30.md',
      'content/outname-launch/X/2026-05-26_15-30.md',
    ],
    slug: '2026-05-26-memory-over-time',
    title: 'Memory over time',
    variants: [
      buildVariant('2026-05-26-memory-over-time', '4x5', 'linkedin'),
      buildVariant('2026-05-26-memory-over-time', '1x1', 'x'),
    ],
  },
  {
    description:
      'Feature video showing tools, sub-agents, MCP/skills, and communication channels as composable building blocks.',
    durationInFrames: FPS_18_SECONDS,
    linkedPosts: [
      'content/outname-launch/LinkedIn/2026-05-28_10-30.md',
      'content/outname-launch/X/2026-05-21_15-30.md',
      'content/outname-launch/X/2026-05-25_15-30.md',
    ],
    slug: '2026-05-28-composable-channels',
    title: 'Composable channels',
    variants: [
      buildVariant('2026-05-28-composable-channels', '4x5', 'linkedin'),
      buildVariant('2026-05-28-composable-channels', '1x1', 'x'),
    ],
  },
  {
    description:
      'Technical X-only video showing the Vercel-native stack behind OUTNA.ME.',
    durationInFrames: FPS_18_SECONDS,
    linkedPosts: [
      'content/outname-launch/X/2026-05-20_15-30.md',
      'content/outname-launch/X/2026-05-28_15-30.md',
    ],
    slug: '2026-05-20-vercel-stack',
    title: 'Vercel agent stack',
    variants: [
      buildVariant('2026-05-20-vercel-stack', '16x9', 'x'),
      buildVariant('2026-05-20-vercel-stack', '1x1', 'x'),
    ],
  },
] as const satisfies readonly LaunchVideoAsset[]

export type LaunchVideoSlug = (typeof launchVideoManifest)[number]['slug']

export function getLaunchVideoAsset(slug: LaunchVideoSlug) {
  const asset = launchVideoManifest.find((item) => item.slug === slug)

  if (!asset) {
    throw new Error(`Launch video not found: ${slug}`)
  }

  return asset
}
