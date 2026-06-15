# Launch Video

Mini-spec for Remotion launch videos in `apps/video`.

Surface:
- `apps/video` runs Remotion Studio on port 3005 from `remotion/index.ts`.
- `RemotionRoot` creates one composition per manifest variant at 30 FPS.
- `LaunchVideo` dispatches by manifest slug and aspect into handcrafted scenes.
- Primitives fix the visual system: black/white panels and `#ff3000` signal tags.
- Remotion public assets are served from `packages/email/static`.

Manifest:
- Aspects are `16x9` 1920x1080, `4x5` 1080x1350, and `1x1` 1080x1080.
- Durations are 540, 600, or 780 frames for 18s, 20s, or 26s videos.
- Each asset records title, description, linked posts, duration, slug, variants.
- Variant MP4s/stills write under `packages/shared/content/outname-launch/assets`.
- `platformUsage` is `x`, `linkedin`, or `cross-post`.

Flows:
- `pnpm video:studio` previews compositions.
- `pnpm video:render:launch` renders every manifest variant.
- `pnpm video:still:launch` writes frame 450 stills for every variant.
- Social launch markdown references rendered asset paths and waitlist CTA URLs.

Invariants:
- Add or remove launch videos in `video-manifest.ts`; root generation follows it.
- A manifest slug needs matching metadata and a `LaunchVideo` branch.
- Renderer creates parent directories and fails fast on non-zero Remotion exits.
- Keep asset paths stable because social post frontmatter points at them.
