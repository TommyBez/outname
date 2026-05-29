# outname

Open-source codebase for outname, a Turborepo monorepo for running personal AI
agents with persistent memory, scheduled work, sandboxed execution, tool
attachments, Slack routing, public web, admin, email preview, and video tooling.

## What the application does

- creates authenticated personal agents with configurable models and tools;
- stores chat, scheduling, and agent state in Neon Postgres;
- executes agent work as event-driven Vercel Workflow runs;
- keeps agent files in persistent Vercel Sandboxes;
- supports browser chat, Slack ingress, waitlist capture, and scheduled loops.

## Stack

- Turborepo + Next.js 16 + React 19
- Better Auth for authentication and access control
- Neon Postgres + Drizzle ORM for persistent data
- Vercel Workflow + Vercel Sandbox for agent execution
- Upstash Redis for cache and coordination
- Vercel Chat SDK for channel integrations
- Resend for waitlist emails

## Repository guide

- `docs/ARCHITECTURE.md` - current system architecture and runtime boundaries
- `CONTRIBUTING.md` - contributor workflow and quality checks
- `SECURITY.md` - vulnerability disclosure process
- `CODE_OF_CONDUCT.md` - community expectations
- `LICENSE` - MIT license
- `.env.example` - local and deployment environment template

## Deploy on Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FTommyBez%2Fpersonal-assistant-agent)

1. Fork this repository and create a new Vercel project from the fork.
2. Set the project runtime to Node.js 24 or newer.
3. Add the environment variables from `.env.example`.
4. Set `BETTER_AUTH_URL` to the production application URL.
5. Create Vercel projects for the deployable apps: `apps/web`, `apps/app`,
   `apps/admin`, and `apps/api`. `apps/email` and `apps/video` are local-only.
6. For the API project, keep the cron configuration from `apps/api/vercel.json`
   for `/api/cron/liveness` and run migrations before deployment.

### Minimum environment variables for a working deploy

```bash
DATABASE_URL=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
BETTER_AUTH_TRUSTED_ORIGINS=
NEXT_PUBLIC_WEB_URL=
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_ADMIN_URL=
NEXT_PUBLIC_API_BASE_URL=
AUTH_COOKIE_DOMAIN=
CONNECTION_ENCRYPTION_KEY=
AI_GATEWAY_API_KEY=
RESEND_API_KEY=
AUTH_FROM_EMAIL=
AUTH_REPLY_TO=
```

### Common optional integrations

- Slack: `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`
- Redis (Upstash via Vercel KV): `KV_REST_API_URL`, `KV_REST_API_TOKEN`
- Auth email: `RESEND_API_KEY`, `AUTH_FROM_EMAIL`, `AUTH_REPLY_TO`
- Waitlist email: `WAITLIST_FROM_EMAIL`, `WAITLIST_REPLY_TO`, `WAITLIST_ADMIN_EMAIL`
- Cron hardening: `CRON_SECRET`

## Local development

### Prerequisites

- Node.js 24 or newer
- pnpm
- Access to the shared database and application secrets

### Setup

```bash
pnpm install
cp .env.example .env.local
```

Fill in `.env.local`, then start the app workspace you need:

```bash
pnpm dev:app
```

Open `http://localhost:3000`. Public web runs on `pnpm dev:web`
(`http://localhost:3002`), API on `pnpm dev:api` (`http://localhost:3001`),
admin on `pnpm dev:admin` (`http://localhost:3003`), React Email preview on
`pnpm dev:email` (`http://localhost:3004`), and Remotion Studio on
`pnpm dev:video` (`http://localhost:3005`).

### Local development notes

- This is a Turborepo monorepo with deployable apps in `apps/*` and shared
  packages in `packages/*`.
- The only required local service is the relevant Next.js dev server; email and
  video workspaces are local-only tools.
- The database is remote; no local Postgres setup is required.
- Sign-up stays disabled; accounts are provisioned from the waitlist and sign-in
  happens with one-time codes sent by email.
- Use `TEST_USER_EMAIL` for a provisioned dev account when available, then
  request an OTP from the login page.
- Local development is enough for day-to-day product work; use Vercel when you
  want to exercise cron-driven flows or hosted integrations end-to-end.

## Common commands

```bash
pnpm dev
pnpm dev:app
pnpm dev:api
pnpm dev:web
pnpm dev:admin
pnpm dev:email
pnpm dev:video
pnpm build
pnpm build:vercel
pnpm start
pnpm lint
pnpm typecheck
pnpm react-doctor
pnpm verify
pnpm fix
pnpm db:generate
pnpm db:migrate
pnpm db:push
pnpm db:studio
```

## Contributing

Please read `CONTRIBUTING.md` before opening a pull request. For substantive
changes, update user-facing documentation together with the code so the
open-source repository stays self-serve.
