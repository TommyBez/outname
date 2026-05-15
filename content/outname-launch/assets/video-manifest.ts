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
  linkedPosts: readonly string[]
  slug: string
  title: string
  variants: readonly LaunchVideoVariant[]
}

export const scheduledRunVideo = {
  description:
    'Silent Remotion-generated simil-demo showing a scheduled run, queue check, tool activity, memory writes, and a readable execution trace.',
  linkedPosts: [
    'content/outname-launch/X/2026-05-22_15-30.md',
    'content/outname-launch/LinkedIn/2026-05-22_10-30.md',
  ],
  slug: '2026-05-22-scheduled-run-demo',
  title: 'Scheduled run demo',
  variants: [
    {
      aspect: '16x9',
      compositionId: 'scheduled-run-demo-16x9',
      height: 1080,
      outputPath:
        'content/outname-launch/assets/videos/2026-05-22-scheduled-run-demo-16x9.mp4',
      platformUsage: 'x',
      stillPath:
        'content/outname-launch/assets/stills/2026-05-22-scheduled-run-demo-16x9.png',
      width: 1920,
    },
    {
      aspect: '4x5',
      compositionId: 'scheduled-run-demo-4x5',
      height: 1350,
      outputPath:
        'content/outname-launch/assets/videos/2026-05-22-scheduled-run-demo-4x5.mp4',
      platformUsage: 'linkedin',
      stillPath:
        'content/outname-launch/assets/stills/2026-05-22-scheduled-run-demo-4x5.png',
      width: 1080,
    },
    {
      aspect: '1x1',
      compositionId: 'scheduled-run-demo-1x1',
      height: 1080,
      outputPath:
        'content/outname-launch/assets/videos/2026-05-22-scheduled-run-demo-1x1.mp4',
      platformUsage: 'cross-post',
      stillPath:
        'content/outname-launch/assets/stills/2026-05-22-scheduled-run-demo-1x1.png',
      width: 1080,
    },
  ],
} as const satisfies LaunchVideoAsset

export const launchVideoManifest = [scheduledRunVideo] as const
