# Slack Channel Contract
Scope: Slack installation, event ingress, routing, and transcript persistence.
Install:
- Install and callback require a Better Auth session plus `slack:use`.
- State is HMAC-signed, expires after 10 minutes, and only accepts app-local return paths.
- Callback initializes the Chat bundle and wraps OAuth persistence in `withInstallContext({ userId })`.
- `SlackHybridState` refuses to save installation keys without that owner context.
Ingress:
- `/api/channels/slack/events` delegates to the Chat adapter and schedules long work in `after()`.
- `REDIS_URL` is required for Chat SDK locks, queues, dedupe, subscriptions, and ephemeral state.
- Empty text/no-attachment messages, missing thread ids, or missing team ids are dropped before routing.
Routing:
- `externalScopeId` is Slack team id; channel keys use channel id; DM keys use author id with channel fallback.
- Sticky `channel_thread_conversations` mappings win before binding lookup.
- Fan-out is sequential and sorted by installation time, owner id, then agent id.
- Disabled agents post an error; failed agents do not stop later routes.
Persistence:
- User message ids hash channel, scope, external message key, and agent id for idempotency.
Anchors:
- `packages/shared/channels/slack/server/bot.ts`, `packages/shared/channels/slack/server/state.ts`
- `packages/shared/channels/slack/server/incoming-message.ts`
- `packages/shared/channels/server/routing.ts`, `packages/shared/channels/server/dispatch.ts`
- `packages/shared/channels/server/backing-state.ts`
- Tests: `packages/shared/channels/slack/server/incoming-message.test.ts`, `packages/shared/channels/slack/server/state.test.ts`
- Tests: `packages/shared/channels/slack/server/backing-state.test.ts`
- Tests: `packages/shared/channels/server/dispatch.test.ts`
