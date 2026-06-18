# Slack Channel
Scope: Slack install, event ingress, routing, and thread-to-chat persistence for the realtime external channel.
Flow:
- Install/callback require a session and `slack:use`; signed state expires after 10 minutes and binds user id.
- Events route acknowledges within Slack's window and continues processing through `after()`.
- Mentions, DMs, and subscribed messages normalize to `IncomingChannelTurn`; empty messages are dropped.
- Routing considers all installs for a team, rechecks access per owner, then fans out sequentially.
State:
- `channel_installations` stores encrypted bot tokens by user/team; team metadata stays clear.
- `agent_channel_bindings` map user/scope/key/kind to an agent; `channel_thread_conversations` stores sticky threads.
- Redis via `REDIS_URL` stores Chat SDK locks, queues, dedupe, subscriptions, and ephemeral state.
Anchors:
- `apps/api/app/api/channels/slack/events/route.ts`, `install/route.ts`, `oauth/callback/route.ts`
- `packages/shared/channels/slack/server/bot.ts`, `state.ts`, `installations.ts`, `incoming-message.ts`
- `packages/shared/channels/server/routing.ts`, `dispatch.ts`, `bindings.ts`, `installations.ts`
Invariants:
- No Slack install may be saved outside `withInstallContext({ userId })`.
- Scope is Slack team id; channel key is channel id; DM key is author id with channel fallback.
- Sticky thread mapping wins before binding lookup; deterministic message ids dedupe per channel/scope/message/agent.
Failure modes:
- Missing Slack env, missing `slack:use`, missing/invalid state, or OAuth errors redirect with connection error.
- Missing `REDIS_URL` throws during Slack Chat SDK state setup.
- No binding logs a warning and does not run; disabled agents post a channel error.
