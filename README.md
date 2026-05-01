# personal-assistant-agent

Personal AI agent workspace built with Next.js, React, Vercel Workflow, Vercel Sandbox, Better Auth, Neon Postgres, and Drizzle ORM.

The app lets a single authenticated operator create persistent agents, chat with them, configure heartbeat and reflection loops, inspect their memory files, attach tools, and delegate work between agents.

## Architecture

### Application shell

- `app/` contains the Next.js App Router pages and API routes.
- `components/` contains the shared React UI, including the agent dashboard, chat surface, sidebars, forms, and shadcn/Radix-based primitives.
- `app/layout.tsx` wires global metadata, styling, providers, and production analytics.
- `proxy.ts` protects private pages and authenticated API routes with Better Auth session cookies.

### Authentication and user model

- `lib/auth.ts` configures Better Auth with a Drizzle adapter.
- Email/password auth is enabled, but sign-up is disabled. The app is intended to run as a single-user private assistant workspace.
- `lib/auth-guard.ts` provides server-side helpers for private pages, Server Actions, and route handlers.

### Data layer

- `lib/db/schema.ts` defines the Postgres schema for users, sessions, agents, conversations, messages, memory files, pending writes, connections, tools, and tool sandbox builds.
- `lib/db/index.ts` creates a lazy Neon HTTP client and Drizzle instance from `DATABASE_URL`.
- `lib/data.ts` contains cached read helpers for agent lists, memory files, file changes, connections, and attached tools.
- SQL migrations live in `drizzle/`, and `drizzle.config.ts` points Drizzle Kit at `lib/db/schema.ts`.

### Agent runtime

- `lib/agent-session.ts` owns the lifecycle of each long-lived agent session workflow.
- `workflows/agent-session/` handles chat turns, scheduled heartbeats, reflection runs, nested agent invocations, memory writes, sandbox file sync, and ticker control.
- `app/api/agents/[agentId]/chat/route.ts` authenticates chat requests, persists user messages, dispatches the turn into the workflow session, and streams the assistant response back through the AI SDK.
- `app/api/cron/liveness/route.ts` is called by Vercel Cron every 15 minutes to restart dead sessions when `LIVENESS_CRON_ENABLED=true`.

### Tools, connectors, and sandboxes

- `tools/registry.ts` lists maintainer-shipped tools exposed to agents.
- `connectors/registry.ts` lists external connection providers such as Resend and Cal.com.
- `lib/connection-crypto.ts` encrypts stored connection credentials with `CONNECTION_ENCRYPTION_KEY`.
- `workflows/build-tool-sandbox/` builds sandbox snapshots for tools that need isolated runtime setup.
- `tools/sandboxes/` contains tool sandbox manifests and setup definitions.

### Platform services

This project is designed for Vercel-hosted services:

- **Vercel Workflow** runs long-lived agent sessions, heartbeat tickers, sub-agent invocations, and tool sandbox builds.
- **Vercel Sandbox** provides persistent agent memory sandboxes and clean execution sandboxes.
- **Vercel AI Gateway** routes model calls and provides the model catalog used by the agent form.
- **Neon Postgres** stores auth, agents, chats, tools, connections, and memory metadata.

Local development can run the UI and database-backed CRUD flows. Autonomous workflow execution, sandbox snapshots, and production-like heartbeat behavior require a Vercel deployment.

## Local development

### Prerequisites

- Node.js 22 or newer
- pnpm
- Access to the shared Neon database URL and app secrets

Install dependencies:

```bash
pnpm install
```

Create `.env.local` in the project root:

```bash
DATABASE_URL=<neon-postgres-connection-string>
BETTER_AUTH_SECRET=<random-auth-secret>
BETTER_AUTH_URL=http://localhost:3000
CONNECTION_ENCRYPTION_KEY=<base64-encoded-32-byte-key>
AI_GATEWAY_API_KEY=<vercel-ai-gateway-key>
```

Optional cron settings:

```bash
CRON_SECRET=<shared-cron-secret>
LIVENESS_CRON_ENABLED=false
```

Generate a local encryption key with:

```bash
openssl rand -base64 32
```

Start the dev server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Authentication in development

Sign-up is disabled. Use the pre-seeded test user for local login:

```bash
TEST_USER_EMAIL=<provided-email>
TEST_USER_PASSWORD=<provided-password>
```

These values are used as credentials in the login UI; they are not required by the app at runtime unless a seed or test helper needs them.

## Common commands

```bash
pnpm dev          # Start the Next.js dev server
pnpm build        # Create a production build
pnpm start        # Start the production server after building
pnpm check        # Run Ultracite/Biome checks
pnpm fix          # Auto-fix formatting and lint issues
pnpm db:generate  # Generate Drizzle migrations from schema changes
pnpm db:migrate   # Apply generated migrations
pnpm db:push      # Push schema changes directly to the database
pnpm db:studio    # Open Drizzle Studio
```

## Database workflow

1. Update `lib/db/schema.ts`.
2. Generate a migration with `pnpm db:generate`.
3. Review the generated SQL in `drizzle/`.
4. Apply it with `pnpm db:migrate`.

For short-lived development databases, `pnpm db:push` can apply schema changes directly. If Drizzle Kit prompts for confirmation in a non-interactive shell, run `pnpm drizzle-kit push --force` or use an interactive terminal.

## Development notes

- This is a single Next.js application, not a monorepo.
- The dev server is the only local service required; the database is remote Neon Postgres.
- Run `pnpm fix` before committing if `pnpm check` reports formatting or lint issues.
- Do not commit `pnpm-workspace.yaml` build allow-list overrides; they can break production builds for this app.
- Keep platform-specific behavior in mind when debugging locally: workflow runs, sandboxes, and autonomous agent loops are only fully available in Vercel.

## v0 project

This repository is linked to a v0 project. You can continue developing by visiting:

[Continue working on v0](https://v0.app/chat/projects/prj_k8JEeBeWTnlZ0FQy7WV1rNqr5EgU)
