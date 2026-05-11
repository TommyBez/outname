# Slack channel integration

This app supports Slack as a chat surface alongside the built-in web UI.
Conversations sent to the bot in Slack are routed to the same agents,
session workflows, memory, and tool runtime that the dashboard uses.

The integration is built on the [Vercel Chat SDK](https://github.com/vercel/chat)
(`chat` + `@chat-adapter/slack`) so adding more surfaces (Microsoft
Teams, Discord, Telegram, …) is a matter of dropping in another adapter.

## How it works

Each platform user installs the Slack app per workspace via OAuth.
Encrypted bot tokens land in `channel_installations`. Bindings are
scoped per user, and an incoming Slack event fans out to every user
whose binding matches — so two users can install the same Slack
workspace and each route their own agents independently.

Boot requires `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, and
`SLACK_SIGNING_SECRET`; the bot refuses to start without all three.

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
   │  1. resolveAgentsForIncomingMessage
   │     - load all channel_installations for (channel, teamId)
   │       (drop event if the workspace has no installs)
   │     - for each installing user, find a candidate agent via:
   │         · existing channel_thread_conversations row (per user)
   │         · agent_channel_bindings (channel or dm) scoped by userId
   │  2. for each matched agent:
   │       a. ensureConversationForThread (per agent)
   │       b. insertChatMessage (user turn)
   │       c. dispatchChatTurn ──► agent session workflow
   │       d. stream UIMessageChunks back to thread.post()
   ▼
Slack thread (streaming reply)
```

### Layer responsibilities

| Layer                                | Slack-aware? | What it owns                                                                |
| ------------------------------------ | ------------ | --------------------------------------------------------------------------- |
| `app/api/channels/slack/events`      | yes          | HTTP entry point, `waitUntil` for the 3-second Slack ack                    |
| `app/api/channels/slack/install`     | yes          | Authenticated redirect to the Slack OAuth consent screen                    |
| `app/api/channels/slack/oauth/callback` | yes       | Receives the OAuth code, runs `handleOAuthCallback` inside an install scope |
| `lib/channels/slack/bot.ts`          | yes          | Chat SDK bot, mention/DM handlers, OAuth boot wiring                        |
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
  Lookup is `(channel, teamId, externalKey, kind, userId)` and is
  unique on that quintuple, so two platform users can each bind the
  same Slack channel to one of their own agents in the same workspace
  without colliding.
- **`channel_thread_conversations`** — maps a Slack
  `(team, channel, thread_ts)` to a `chat_conversation` row owned by an
  agent. Unique on `(channel, teamId, externalThreadKey, agentId)` so
  each agent owns its own conversation for the thread.

## Multi-user safety contract

The dispatcher guarantees, on every Slack event:

1. The event's `team_id` matches at least one `channel_installations`
   row, **or** the event is dropped.
2. Each candidate agent is resolved under the `userId` of an installing
   user — bindings and thread mappings are unique per user, so an
   agent can only run for the user who owns the install.
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

```bash
SLACK_CLIENT_ID=…
SLACK_CLIENT_SECRET=…
SLACK_SIGNING_SECRET=…
SLACK_BOT_USERNAME=assistant   # optional, used for mention matching
```

**Optional:**

```bash
# When set, the Slack chat surface uses Redis for concurrency locks,
# thread subscriptions, and ephemeral caches. Required for any
# multi-instance deployment. Without it, those state items are
# kept in-process memory.
REDIS_URL=redis://…
```

`CONNECTION_ENCRYPTION_KEY` (already required by the rest of the app)
is reused to encrypt Slack bot tokens at rest, so no extra key is
needed.

## Installing a workspace

The user opens any agent's **Configure → Slack** section in the
dashboard and clicks **Install Slack app** (or **Add workspace** if a
workspace is already installed). They are redirected through the Slack
consent screen, and the callback persists the encrypted bot token
under their user id before redirecting back to the dashboard with a
success notice.

The same flow can be triggered directly via
`https://<your-deployment>/api/channels/slack/install` while logged
into the dashboard.

## Binding an agent to Slack

The dashboard exposes the binding UI on every agent at **Configure →
Slack**. From there you can:

- pick a workspace from the workspaces you have installed;
- choose a routing kind — `channel` or `dm`;
- paste the Slack channel id (`C…`) or user id (`U…`).

Existing bindings are listed alongside their workspace and can be
removed with one click. Bindings whose workspace was uninstalled are
marked **Workspace not installed** so they can be cleaned up.

The same operations are still available programmatically through
`lib/channels/bindings.ts` for scripting:

```ts
import { upsertAgentChannelBinding } from '@/channels/server/bindings'

// Route every Slack message in #general
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

```

The helper looks up the agent's `userId` from the agent row, so the
binding it writes is automatically scoped to the agent's owner.

Without any binding the bot will silently drop incoming events — this
is intentional so installing the app in a busy workspace doesn't cause
the agent to reply to unrelated chatter. Events that target a workspace
with no `channel_installations` row are likewise dropped.

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

- **State**: the Slack route uses `SlackHybridState`, which routes
  `slack:installation:*` reads/writes to Postgres (encrypted) and
  delegates everything else (concurrency locks, thread subscriptions,
  ephemeral caches) to an inner adapter chosen at boot:

  - When `REDIS_URL` is set, `@chat-adapter/state-redis` is used.
    Locks become distributed across processes and thread
    subscriptions survive cold starts — this is the correct setting
    for any multi-instance deployment.
  - Otherwise `@chat-adapter/state-memory` is used and a one-time
    warning is logged. Fine for local development and single-instance
    deployments.

  Switching is a deployment-time toggle — set or unset `REDIS_URL`
  and redeploy.
- **Slack 3-second ack**: the route uses Next.js's `after()` so the
  agent run continues after the webhook response is on the wire. Slack
  will not retry a long-running model turn.
- **Streaming**: `thread.post(asyncIterable)` lets the Slack adapter
  edit the message in place as text deltas arrive, giving the
  streaming-reply experience without managing rate limits manually.
- **Paused agents**: if the matched agent is disabled, the user is told
  to enable it from the dashboard rather than getting silence.
