# Test Matrix

Scope: verification commands for platform and product-surface changes.

Commands:
- `pnpm docs:check` validates generated docs indexes and 30-line source docs.
- `pnpm verify` runs docs check plus Turbo build, typecheck, lint, react-doctor.
- `pnpm test` runs Vitest and imports database-backed modules; set `DATABASE_URL`.
- `pnpm test:typecheck` checks the Vitest TypeScript project.
- Workspace `typecheck`, `lint`, and `react-doctor` run through Turbo filters.
- `pnpm dev:web`, `dev:app`, `dev:api`, `dev:email`, `dev:video` run local surfaces.

Focused anchors:
- Next config and related project URL behavior: shared config tests.
- Email link resolution: `packages/shared/server/email-urls.test.ts`.
- Revalidation side effects: channel dispatch, chat title, and realtime runner tests.
- API stream/transcript contract: route tests under `apps/api/app/api/agents`.
- UI shell and auth changes need manual browser verification.
- Marketing, email preview, and launch video have no full product test suite.

Invariants:
- Generated docs indexes are intentionally not edited in this slice.
- Use line counts for new non-index docs when skipping `docs:check`.
- Browser verification is required for UI/auth behavior after implementation edits.

Anchors: `package.json`, `vitest*.ts`, `apps/*/doctor.config.json`,
`packages/*/doctor.config.json`, `AGENTS.md`.
