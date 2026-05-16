# outname

Open-source codebase for outname, a Next.js application for running personal AI
agents with persistent memory, scheduled work, sandboxed execution, tool
attachments, and Slack routing.

## What the application does

- creates authenticated personal agents with configurable models and tools;
- stores chat, scheduling, and agent state in Neon Postgres;
- executes agent work as event-driven Vercel Workflow runs;
- keeps agent files in persistent Vercel Sandboxes;
- supports browser chat, Slack ingress, waitlist capture, and scheduled loops.

## Stack

- Next.js 16 + React 19
- Better Auth for authentication and access control
- Neon Postgres + Drizzle ORM for persistent data
- Vercel Workflow + Vercel Sandbox for agent execution
- Upstash Redis for cache and coordination
- Slack Chat SDK for channel integrations
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
2. Set the project runtime to Node.js 22 or newer.
3. Add the environment variables from `.env.example`.
4. Set `BETTER_AUTH_URL` to the production application URL.
5. Use `pnpm build:vercel` as the build command so database migrations run
   before the Next.js build.
6. Deploy the project. `vercel.json` already provisions the scheduler cron for
   `/api/cron/liveness`.

### Minimum environment variables for a working deploy

```bash
DATABASE_URL=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
CONNECTION_ENCRYPTION_KEY=
AI_GATEWAY_API_KEY=
```

### Common optional integrations

- Slack: `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`
- Redis coordination: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- Transactional email: `RESEND_API_KEY`, `AUTH_FROM_EMAIL` or `WAITLIST_FROM_EMAIL`
- Waitlist rate limit: `KV_REST_API_URL`, `KV_REST_API_TOKEN`
- Cron hardening: `CRON_SECRET`

## Local development

### Prerequisites

- Node.js 22 or newer
- pnpm
- Access to the shared database and application secrets

### Setup

```bash
pnpm install
cp .env.example .env.local
```

Fill in `.env.local`, then start the app:

```bash
pnpm dev
```

Open `http://localhost:3000`.

### Local development notes

- This is a single Next.js application, not a monorepo.
- The only required local service is the Next.js dev server.
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
pnpm build
pnpm build:vercel
pnpm start
pnpm check
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
