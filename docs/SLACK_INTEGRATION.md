# Slack channel integration

This app supports Slack as a chat surface alongside the built-in web UI.
Conversations sent to the bot in Slack are routed to the same agents,
session workflows, memory, and tool runtime that the dashboard uses.

The integration is built on the [Vercel Chat SDK](https://github.com/vercel/chat)
(`chat` + `@chat-adapter/slack`) so adding more surfaces (Microsoft
Teams, Discord, Telegram, …) is a matter of dropping in another adapter.

## Operating modes

The Slack route boots in one of two modes, picked at startup from
environment variables:

| Mode               | When                                                         | Multi-user safe? |
| ------------------ | ------------------------------------------------------------ | ---------------- |
| Multi-workspace    | `SLACK_CLIENT_ID` + `SLACK_CLIENT_SECRET` + `SLACK_SIGNING_SECRET` | yes              |
| Single-workspace   | only `SLACK_BOT_TOKEN` + `SLACK_SIGNING_SECRET`              | no — single operator only |

In multi-workspace mode every install is performed via OAuth, encrypted
bot tokens land in `channel_installations`, and the dispatcher cross-checks
that the installation owner equals the matched agent's owner before
running the turn.

In single-workspace mode there is one global bot token from the
environment, all bindings carry `teamId = ''`, and there is no
cross-user owner check (because there is no second user). Use it only
for personal deployments.

## Architecture

```
Slack workspace
   │  Events API
   ▼
POST /api/channels/slack/events  ◄─ verifies signing secret, dedupes
   │                                via @chat-adapter/slack
   ▼
slackBot (Vercel Chat SDK)        ◄─ lib/channels/slack/bot.ts
   │  onNewMention / onDirectMessage / onSubscribedMessage
   │  extracts (channel, thread_ts, team_id) from each event
   ▼
runChannelChatTurn                ◄─ lib/channels/dispatch.ts
   │  1. resolveAgentForIncomingMessage
   │     - load channel_installations by (channel, teamId)
   │       (drop event if the workspace is not installed)
   │     - find candidate agent via:
   │         · existing channel_thread_conversations row
   │         · agent_channel_bindings (channel|dm) for this teamId
   │         · agent_channel_bindings ('default') for this teamId
   │     - reject if agent.userId !== installation.userId
   │  2. ensureConversationForThread
   │  3. insertChatMessage (user turn)
   │  4. dispatchChatTurn ──► agent session workflow
   │  5. stream UIMessageChunks back to thread.post()
   ▼
Slack thread (streaming reply)
```

### Layer responsibilities

| Layer                                | Slack-aware? | What it owns                                                                |
| ------------------------------------ | ------------ | --------------------------------------------------------------------------- |
| `app/api/channels/slack/events`      | yes          | HTTP entry point, `waitUntil` for the 3-second Slack ack                    |
| `app/api/channels/slack/install`     | yes          | Authenticated redirect to the Slack OAuth consent screen                    |
| `app/api/channels/slack/oauth/callback` | yes       | Receives the OAuth code, runs `handleOAuthCallback` inside an install scope |
| `lib/channels/slack/bot.ts`          | yes          | Chat SDK bot, mention/DM handlers, single-vs-multi-workspace switch         |
| `lib/channels/slack/state.ts`        | yes          | `SlackHybridState` — bridges `slack:installation:*` keys to Postgres        |
| `lib/channels/slack/installations.ts`| yes          | Encrypt/decrypt bot tokens via `connection-crypto.ts`                       |
| `lib/channels/dispatch.ts`           | no           | Generic event → agent → workflow → reply pipeline (reused by every channel) |
| `lib/channels/routing.ts`            | no           | Owner-scoped agent resolution + `chat_conversation` reuse                   |
| `workflows/agent-session/...`        | no           | Existing model/tool runtime — unchanged                                     |

## Database

Three tables back the integration (migrations
`0014_channel_bindings.sql` + `0015_channel_team_id.sql`):

- **`channel_installations`** — per-(user, channel, workspace) record.
  Holds the encrypted bot token in `credentials` (AES-256-GCM via
  `connection-crypto.ts`) and platform metadata
  (`{ botUserId, teamName }`) in `metadata`.
- **`agent_channel_bindings`** — routes incoming messages to an agent.
  Lookup is `(channel, teamId, externalKey, kind)` and is unique on
  that quadruple, so two users with separate Slack workspaces can each
  bind the same channel id to their own agent without colliding.
- **`channel_thread_conversations`** — maps a Slack
  `(team, channel, thread_ts)` to a `chat_conversation` row owned by an
  agent. Once a thread has exchanged one message, every follow-up
  routes back to the same agent regardless of binding changes.

## Multi-user safety contract

The dispatcher guarantees, on every Slack event:

1. The event's `team_id` matches a `channel_installations` row, **or**
   the event is dropped.
2. The matched agent's `userId` equals
   `channel_installations.userId`, **or** the event is dropped and
   logged. This holds whether the agent was found via
   `channel_thread_conversations`, a `(channel|dm)` binding, or the
   `'default'` binding.
3. Bot tokens are decrypted in-process — `channel_installations.credentials`
   only contains the AES-256-GCM envelope.
4. The OAuth callback verifies the originating user against the active
   Better Auth session before saving the install; the `state` parameter
   carries the user id and session token so a leaked install URL cannot
   be replayed against a different account.
5. The custom `SlackHybridState` adapter refuses to persist a Slack
   installation outside an `withInstallContext({ userId }, …)` scope,
   so a misconfigured code path cannot land an unowned token.

## Slack app setup

1. Create a Slack app at <https://api.slack.com/apps>.
2. Under **OAuth & Permissions** add the bot scopes:
   - `app_mentions:read`
   - `chat:write`
   - `channels:history`, `groups:history`, `mpim:history`
   - `im:history`, `im:read`, `im:write` (for DMs)
   - `users:read`
   - `assistant:write` (optional — Slack Assistants UI)
3. Set the **Redirect URL** to
   `https://<your-deployment>/api/channels/slack/oauth/callback`.
4. Under **Basic Information** copy the **Client ID**, **Client Secret**,
   and **Signing Secret**.
5. Under **Event Subscriptions**:
   - Enable events.
   - Set the **Request URL** to
     `https://<your-deployment>/api/channels/slack/events`. Slack will
     challenge it; the SDK answers automatically.
   - Subscribe to bot events:
     - `app_mention`
     - `message.im` (DMs)
     - `message.channels` (only if you want auto-replies in subscribed
       channel threads without re-mentioning the bot)
6. Reinstall the app if you changed scopes or events.

## Environment variables

Add to `.env.local` (and your Vercel project settings).

**Multi-workspace (recommended):**

```bash
SLACK_CLIENT_ID=…
SLACK_CLIENT_SECRET=…
SLACK_SIGNING_SECRET=…
SLACK_BOT_USERNAME=assistant   # optional, used for mention matching
```

**Single-workspace (single operator only):**

```bash
SLACK_BOT_TOKEN=xoxb-…
SLACK_SIGNING_SECRET=…
SLACK_BOT_USERNAME=assistant
```

`CONNECTION_ENCRYPTION_KEY` (already required by the rest of the app)
is reused to encrypt Slack bot tokens at rest, so no extra key is
needed.

## Installing a workspace

In multi-workspace mode the operator visits
`https://<your-deployment>/api/channels/slack/install` while logged
into the dashboard. They are redirected through the Slack consent
screen, and the callback persists the encrypted bot token under their
user id.

## Binding an agent to Slack

Run a one-off script (e.g. via `tsx`) to create a routing binding. The
helper is exported from `lib/channels/bindings.ts`:

```ts
import { upsertAgentChannelBinding } from '@/lib/channels/bindings'

// Route every Slack message in #general (multi-workspace mode)
await upsertAgentChannelBinding({
  agentId: 'agent_…',
  channel: 'slack',
  teamId: 'T0123456789',          // Slack workspace id
  externalKey: 'C0123456789',     // Slack channel id
  kind: 'channel',
})

// Or: route a 1:1 DM to an agent
await upsertAgentChannelBinding({
  agentId: 'agent_…',
  channel: 'slack',
  teamId: 'T0123456789',
  externalKey: 'U0123456789',     // Slack user id
  kind: 'dm',
})

// Or: a per-workspace fallback for any thread without an explicit binding
await upsertAgentChannelBinding({
  agentId: 'agent_…',
  channel: 'slack',
  teamId: 'T0123456789',
  externalKey: '',
  kind: 'default',
})
```

For single-workspace mode, set `teamId: ''`.

Without any binding the bot will silently drop incoming events — this
is intentional so installing the app in a busy workspace doesn't cause
the agent to reply to unrelated chatter. Bindings whose agent is owned
by a different user than the workspace install are also dropped, with a
warning logged.

## Adding another channel

To support, e.g., Microsoft Teams:

1. `pnpm add @chat-adapter/teams` (or whichever official adapter).
2. Add `'teams'` to the `ChannelId` union in `lib/channels/types.ts`.
3. Create `lib/channels/teams/bot.ts` mirroring `slack/bot.ts`:
   construct a `Chat` instance, register handlers, extract the workspace
   id (Teams tenant id) into `IncomingChannelMessage.teamId`, and call
   `runChannelChatTurn` from `lib/channels/dispatch.ts`.
4. Add `app/api/channels/teams/events/route.ts` that delegates to the
   bot's `webhooks.teams(request, …)`.
5. Reuse the same `channel_installations` / `agent_channel_bindings`
   tables — the schema is already channel-agnostic.

The dispatch layer doesn't need to change — `runChannelChatTurn` is
channel-agnostic and writes through the existing chat persistence and
workflow code paths.

## Operational notes

- **State**: the Slack route uses `SlackHybridState`, which keeps
  concurrency locks and thread subscriptions in-memory and routes
  `slack:installation:*` reads/writes to Postgres. Locks are
  per-instance, which is fine on Vercel Functions for a single user
  (each invocation handles one Slack thread). For multi-instance
  hardening, swap the inner adapter to `@chat-adapter/state-redis`.
- **Slack 3-second ack**: the route uses Next.js's `after()` so the
  agent run continues after the webhook response is on the wire. Slack
  will not retry a long-running model turn.
- **Streaming**: `thread.post(asyncIterable)` lets the Slack adapter
  edit the message in place as text deltas arrive, giving the
  streaming-reply experience without managing rate limits manually.
- **Paused agents**: if the matched agent is disabled, the user is told
  to enable it from the dashboard rather than getting silence.
