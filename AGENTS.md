# Agent Rules

Keep this file minimal. Put feature knowledge in `docs/<feature>/` and keep
tool-specific preferences out unless they are hard project constraints.

## Documentation

- Every feature document lives under a feature folder in `docs/`.
- Non-index markdown files under `docs/` must stay at 30 lines or fewer.
- Generated `index.md` files may exceed 30 lines when needed for navigation.
- If a docs folder has more than one markdown file, it must have `index.md`.
- `docs/index.md` and folder indexes are generated; update source docs, then run
  `pnpm docs:index` instead of hand-editing generated indexes.

## Runtime Caveats

- The database is remote Neon Postgres through `DATABASE_URL`; no local Postgres
  is expected. Use the pooled Neon hostname containing `-pooler`.
- Next.js needs `.env.local` at runtime even when secrets are injected by the
  environment.
- In session workflow codepaths, prefer static imports for modules touching
  `@outname/db` or server helpers. Use dynamic imports only for truly optional
  runtime-local paths.
- Public sign-up is disabled in Better Auth. Dev users are provisioned from the
  waitlist and sign in with email OTP codes.
- For dev OTP login, request `/api/auth/request-otp`, read the newest
  `verification.value`, then submit the code before `:` to
  `/api/auth/sign-in/email-otp`.
- `drizzle-kit push` prompts for confirmation unless run with `--force` or an
  interactive TTY.
- Do not commit `pnpm-workspace.yaml` allow-build overrides; they break
  production builds.
- UI and auth changes need manual browser verification because there is no full
  product test suite for those flows.
- `pnpm test` imports database-backed modules; set `DATABASE_URL` first or source
  `.env.local`.
