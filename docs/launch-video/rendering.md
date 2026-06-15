# Rendering

Scope: local preview and asset rendering for `apps/video`.

Commands:
- `pnpm video:studio` runs Remotion Studio through the video workspace.
- `pnpm video:render:launch` renders every manifest variant to MP4.
- `pnpm video:still:launch` renders stills for every manifest variant.
- Direct workspace scripts are `render:launch` and `still:launch`.

Renderer contract:
- Entry point is `remotion/index.ts`.
- Still frame is fixed at frame `450`.
- The script creates output directories before invoking Remotion.
- Render and still commands pass `--overwrite`.
- Non-zero Remotion exit status throws and stops the script.
- Remotion config enables Tailwind and aliases shared packages.
- Public assets come from `../../packages/email/static`.

Invariants:
- Keep manifest output paths repo-root relative.
- Keep logo/static files available to both email previews and video renders.

Anchors: `apps/video/package.json`, `apps/video/scripts/render-launch-videos.ts`,
`apps/video/remotion.config.ts`, `apps/video/remotion/index.ts`.
