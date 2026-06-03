# Contributing

Thanks for your interest in improving `outname`.

## Before you open a pull request

1. Read `README.md` for the product overview and setup steps.
2. Read `.env.example` and create `.env.local` for local development.
3. Read `docs/ARCHITECTURE.md` if your change touches runtime behavior,
   integrations, or data flow.

## Local setup

```bash
pnpm install
cp .env.example .env.local
pnpm portless:trust   # once, if HTTPS shows a certificate warning
pnpm dev:app
```

Notes:

- Local dev uses [Portless](https://portless.sh/) for stable HTTPS URLs on
  `*.outname.localhost`. Use `pnpm dev:local` to bypass Portless and run on
  localhost ports instead.

- Use Node.js 24 or newer.
- This repository is a Turborepo monorepo with apps in `apps/*` and shared
  packages in `packages/*`.
- The database is remote, so no local Postgres instance is required.
- Set `AUTH_FROM_EMAIL` and `AUTH_REPLY_TO` in `.env.local` for auth emails, and
  keep `WAITLIST_FROM_EMAIL`, `WAITLIST_REPLY_TO`, and `WAITLIST_ADMIN_EMAIL` for
  waitlist mail.
- Sign-up is disabled; provision a user through the waitlist flow or use the
  provisioned test address from `TEST_USER_EMAIL`, then request an email OTP
  from `/login`.

## Development workflow

- Keep pull requests focused and easy to review.
- Update docs when you change setup, architecture, or user-facing behavior.
- Do not commit secrets or populated `.env.local` files.
- Do not commit `pnpm-workspace.yaml` allow-build overrides; they break the
  production build for this application.

## Validation

Run the smallest high-signal checks for your change before opening a pull
request:

```bash
pnpm verify
```

`pnpm verify` runs the workflow boundary check plus `build`, `typecheck`,
`lint`, and `react-doctor` across the monorepo.

If you changed TypeScript runtime code, also run:

```bash
pnpm test
pnpm test:typecheck
pnpm test:workflow:unit
```

If your change affects cron, Slack delivery, or other hosted integrations,
validate it in a Vercel environment when practical. Most product and UI work
can still be developed and reviewed locally.

## Pull request checklist

- Explain the problem and the chosen solution clearly.
- Link related issues or discussions.
- Include screenshots or recordings for UI changes.
- Mention any new environment variables, migrations, or operational steps.
