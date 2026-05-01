# personal-assistant-agent

Personal AI agent workspace built with Next.js, React, Vercel Workflow, Vercel Sandbox, Better Auth, Neon Postgres, and Drizzle ORM.

The app lets a single authenticated operator create persistent agents, chat with them, configure heartbeat and reflection loops, inspect their memory files, attach tools, and delegate work between agents.

## Architecture

This is a single-tenant personal assistant workspace. The Next.js app is the control plane: it renders the operator UI, authenticates the user, owns configuration changes, and exposes route handlers that bridge browser actions into durable agent workflows.

The system has four main layers:

1. **Operator interface**: App Router pages render the landing page, dashboard, agent detail views, chat, memory files, tool catalog, and settings. Most data-changing interactions are Server Actions so form submissions and UI controls execute on the server with the current Better Auth session.
2. **Persistence and authorization**: Better Auth stores users and sessions in Neon Postgres through Drizzle. Every agent, conversation, message, memory-file mirror, pending write, connection, and attached tool is also persisted in Postgres. Request-time helpers enforce that each read or mutation is scoped to the authenticated owner.
3. **Durable agent runtime**: Each enabled agent is backed by a long-lived Vercel Workflow session. Chat turns, heartbeat checks, reflection runs, and sub-agent calls are delivered into that session as events. The workflow streams model output back to the UI, applies queued memory writes, mirrors markdown memory files into Postgres, and releases sandboxes at the end of each event so their filesystems can be snapshotted.
4. **Execution and integration layer**: Agents can use maintainer-provided tools, encrypted external connections, other agents as sub-agents, and sandbox-backed tools. Vercel Sandbox separates persistent agent memory from clean execution environments, while Vercel AI Gateway supplies model routing and the model catalog.

### Request and session flow

Private pages and API routes require a Better Auth session cookie. Unauthenticated browser requests are redirected to `/login`; API handlers return authorization errors. Sign-up is disabled, so local and production use assume a pre-seeded single operator account.

After login, the dashboard reads the operator's agents from Postgres. Creating or editing an agent writes the agent row, validates the selected AI Gateway model, queues any persona/instruction file updates, and starts or updates the agent's workflow session. Pausing an agent stops its session; re-enabling it starts a fresh one if needed.

### Chat flow

When the operator sends a chat message:

1. The chat route verifies the session and confirms the agent belongs to the current user.
2. The user message is saved to the conversation before model work begins, so the transcript survives workflow or streaming failures.
3. The route resumes the agent's long-lived workflow session with a chat event and a per-turn reply token.
4. The workflow loads the agent's model, memory, persona files, attached tools, and connection state, then streams model chunks into the run namespace for that reply token.
5. The route pipes those chunks back to the browser using the AI SDK UI message stream.
6. At the end of the workflow event, assistant output and memory changes are persisted, markdown memory files are mirrored into Postgres, and sandbox state is released for snapshotting.

### Heartbeats, reflection, and liveness

Agents can be configured for recurring heartbeat work and separate reflection work. A session workflow starts a sibling ticker workflow that gates each scheduled tick on completion of the previous event, preventing overlapping heartbeat runs for the same agent.

Vercel Cron calls the liveness endpoint every 15 minutes. When enabled, it checks every active agent's latest workflow run and restarts sessions that died or belong to an older deployment world. This keeps proactive agents recoverable without requiring the operator to open the UI.

### Memory and files

Agent memory lives primarily as markdown files in the agent's persistent system sandbox. The database stores a mirrored view of those files so the UI can render logs, memory, and file-change history without reopening the sandbox for every page load. Pending writes created from forms are queued in Postgres and drained by the next workflow event, which keeps file mutations ordered with model activity.

### Tools and external connections

Maintainer-shipped tools are registered centrally and can require either user-provided connection credentials, a sandbox snapshot, or neither. Connection credentials are encrypted before they are stored. Tools that need their own runtime setup are built by a separate workflow that creates a sandbox snapshot and marks waiting agent-tool rows as connected when the build succeeds. Sub-agent tools are represented as database attachments and are resolved at runtime with recursion guards.

### Local versus deployed behavior

Local development uses the same Next.js app, Better Auth configuration, Drizzle schema, and remote Neon database. It is good for UI work and database-backed CRUD flows.

Production-like autonomous behavior depends on Vercel-hosted services:

- Vercel Workflow runs long-lived agent sessions, ticker workflows, sub-agent invocations, and tool sandbox builds.
- Vercel Sandbox provides persistent memory sandboxes and clean execution sandboxes.
- Vercel AI Gateway routes model calls and provides the model catalog.
- Vercel Cron drives the liveness sweeper.

Because of those dependencies, local development can render the UI and exercise normal data paths, but autonomous agent execution, sandbox snapshotting, and scheduled heartbeat behavior are only fully representative in a Vercel deployment.

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
