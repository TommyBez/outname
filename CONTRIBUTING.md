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
pnpm dev
```

Notes:

- Use Node.js 22 or newer.
- This repository is a single Next.js application, not a monorepo.
- The database is remote, so no local Postgres instance is required.
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
pnpm check
```

If you changed TypeScript runtime code, also run:

```bash
pnpm test
pnpm test:typecheck
```

If your change affects cron, Slack delivery, or other hosted integrations,
validate it in a Vercel environment when practical. Most product and UI work
can still be developed and reviewed locally.

## Pull request checklist

- Explain the problem and the chosen solution clearly.
- Link related issues or discussions.
- Include screenshots or recordings for UI changes.
- Mention any new environment variables, migrations, or operational steps.
