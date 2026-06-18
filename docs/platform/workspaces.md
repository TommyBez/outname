# Platform Workspaces

Mini-spec for repo workspaces that ship or preview product surfaces.

Evidence: `package.json`, `apps/web`, `apps/email`, `apps/video`,
`packages/email`, `packages/shared/marketing`, `packages/shared/content`.

Responsibilities:
- Root `outname` is a private Turborepo on `pnpm@10.33.0`, Node `>=24`.
- `apps/web` is the public Next app on port 3002.
- `apps/email` is the React Email preview app on port 3004.
- `apps/video` is the Remotion Studio workspace on port 3005.
- Shared marketing UI/content lives in `packages/shared/marketing`.
- Blog and launch content live in `packages/shared/content`.
- Transactional email source lives in `packages/email`, not the preview app.

Flows:
- `pnpm dev:web`, `pnpm dev:email`, and `pnpm dev:video` use Turbo filters.
- `pnpm email` aliases email preview; `pnpm video:studio` aliases Remotion.
- `pnpm video:render:launch` and `pnpm video:still:launch` render launch assets.
- `pnpm verify` runs `docs:check` before build/typecheck/lint/react-doctor.

Invariants:
- Do not hand-edit generated docs indexes; run `pnpm docs:index` when needed.
- Feature docs stay under `docs/<feature>/`.
- Every non-index markdown file under `docs/` must be 30 lines or fewer.
- Keep public site, email preview, and video render workspaces decoupled.
