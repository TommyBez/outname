# Core Data
Scope: Durable Postgres boundary for auth, agents, chats, channels, credentials, inference, budgets, and waitlist.
Flow:
- API routes under `apps/api/app/api` validate input/auth and delegate writes to package server helpers.
- Schema modules define ownership, cascade behavior, uniqueness, and indexes used by routing and budgeting.
State:
- Identity and agents: `user`, `session`, `account`, `verification`, `agent`, `agent_events`, `agent_event_message`.
- Chat/channel: `chat_conversation`, `chat_message`, `channel_installations`, `agent_channel_bindings`, `channel_thread_conversations`.
- Credentials/spend/acquisition: `user_connections`, `user_inference_credentials`, `budget_rule`, `agent_token_usage`, `waitlist_entries`.
Anchors:
- `packages/db/schema/auth.ts`, `agents.ts`, `chat.ts`, `channels.ts`, `connections.ts`
- `packages/db/schema/inference.ts`, `budgets.ts`, `waitlist.ts`, `skills.ts`, `tools.ts`
- `apps/api/app/api/auth/*`, `connections/oauth/*`, `channels/slack/*`, `waitlist/*`
Invariants:
- User-owned app tables cascade on user delete; waitlist `provisionedUserId` is set null.
- Channel, connector, and inference credential blobs are encrypted; clear metadata is for routing/UI.
- Provider and model are stored together on `agent`; credentials are scoped by user plus connector/provider.
- Event idempotency, active concurrency, channel threads, bindings, and budget scopes have uniqueness constraints.
Failure modes:
- Foreign keys cascade/delete dependent state; unique conflicts are handled by upsert or canonical re-read helpers.
- Server routes/actions must prove session ownership before writing user- or agent-scoped rows.
