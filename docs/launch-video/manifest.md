# Manifest

Scope: launch video metadata and composition generation.

Manifest contract:
- `launchVideoManifest` is the source of slugs, titles, descriptions, and variants.
- Aspects are `16x9`, `4x5`, and `1x1`.
- Dimensions are 1920x1080, 1080x1350, and 1080x1080.
- Durations are 540, 600, or 780 frames at 30 FPS.
- Variant IDs are `${slug}-${aspect}`.
- MP4 and still paths live under `packages/shared/content/outname-launch/assets`.
- `platformUsage` is `x`, `linkedin`, or `cross-post`.
- `linkedPosts` points to launch social markdown that references rendered assets.

Implementation contract:
- `RemotionRoot` creates one `Composition` per manifest variant.
- `LaunchVideo` must have a branch for every manifest slug.
- Static assets resolve from the Remotion public dir, currently email static assets.

Failure modes:
- A manifest slug without a `LaunchVideo` branch falls through to generic story logic.
- Changing output paths can break social post frontmatter references.

Anchors: `packages/shared/content/outname-launch/assets/video-manifest.ts`,
`apps/video/remotion/root.tsx`, `apps/video/remotion/launch-videos.tsx`.
