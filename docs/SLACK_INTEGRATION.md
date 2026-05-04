# Slack channel integration

This app supports Slack as a chat surface alongside the built-in web UI.
Conversations sent to the bot in Slack are routed to the same agents,
session workflows, memory, and tool runtime that the dashboard uses.

The integration is built on the [Vercel Chat SDK](https://github.com/vercel/chat)
(`chat` + `@chat-adapter/slack`) so adding more surfaces (Microsoft
Teams, Discord, Telegram, …) is a matter of dropping in another adapter.

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
   ▼
runChannelChatTurn                ◄─ lib/channels/dispatch.ts
   │  1. resolveAgentForIncomingMessage
   │     - existing channel_thread_conversations row?
   │     - agent_channel_bindings (channel|dm)?
   │     - agent_channel_bindings (default)?
   │  2. ensureConversationForThread
   │     - reuses or creates a chat_conversation row
   │  3. insertChatMessage (user turn)
   │  4. dispatchChatTurn ──► agent session workflow
   │  5. stream UIMessageChunks back to thread.post()
   ▼
Slack thread (streaming reply)
```

The pieces are intentionally split:

| Layer                                | Slack-aware? | What it owns                                                                |
| ------------------------------------ | ------------ | --------------------------------------------------------------------------- |
| `app/api/channels/slack/events`      | yes          | HTTP entry point, `waitUntil` for the 3-second Slack ack                    |
| `lib/channels/slack/bot.ts`          | yes          | Chat SDK bot, mention/DM handlers, Slack-specific routing key extraction    |
| `lib/channels/dispatch.ts`           | no           | Generic event → agent → workflow → reply pipeline (reused by every channel) |
| `lib/channels/routing.ts`            | no           | Binding lookup + `chat_conversation` reuse                                  |
| `workflows/agent-session/...`        | no           | Existing model/tool runtime — unchanged                                     |

## Database

Three tables back the integration (migration `0014_channel_bindings.sql`):

- **`channel_installations`** — per-(user, channel, workspace) record
  for OAuth installs and bot tokens. Today the single-workspace,
  single-operator setup uses `SLACK_BOT_TOKEN` directly so this table is
  optional, but it is wired up so multi-workspace OAuth can be added
  without further schema work.
- **`agent_channel_bindings`** — routes incoming messages to a specific
  agent. Lookup is `(channel, externalKey, kind)` and is unique on that
  triple, so a Slack channel cannot accidentally be bound to two agents
  at once.
- **`channel_thread_conversations`** — maps a Slack `channel:thread_ts`
  to a `chat_conversation` row owned by an agent. Once a thread has
  exchanged one message, every follow-up routes back to the same agent
  regardless of binding changes.

## Slack app setup

1. Create a Slack app at <https://api.slack.com/apps> using "From
   scratch", and pick the workspace you want the bot to live in.
2. Under **OAuth & Permissions** add the bot scopes you need:
   - `app_mentions:read`
   - `chat:write`
   - `im:history`, `im:read`, `im:write` (for DMs)
   - `users:read` (so the SDK can resolve display names)
   - `assistant:write` (optional, for the Slack Assistants UI)
3. Install the app to your workspace and copy the **Bot User OAuth
   Token** (`xoxb-…`).
4. Under **Basic Information** copy the **Signing Secret**.
5. Under **Event Subscriptions**:
   - Enable events.
   - Set the **Request URL** to
     `https://<your-deployment>.vercel.app/api/channels/slack/events`.
     Slack will challenge it; the SDK answers automatically.
   - Subscribe to bot events:
     - `app_mention`
     - `message.im` (for DMs)
     - `message.channels` (only if you want responses to follow-ups in
       channel threads without an explicit @mention)
6. Reinstall the app if you changed scopes or events.

## Environment variables

Add to `.env.local` (and your Vercel project settings):

```bash
SLACK_BOT_TOKEN=xoxb-…
SLACK_SIGNING_SECRET=…
# Optional — display name used by the SDK for mention matching.
SLACK_BOT_USERNAME=assistant
```

The Chat SDK auto-detects `SLACK_BOT_TOKEN` and `SLACK_SIGNING_SECRET`
from the environment, so they don't need to be passed to
`createSlackAdapter()` explicitly.

## Binding an agent to Slack

Run a one-off script (e.g. via `tsx`) to create a routing binding. The
helper is exported from `lib/channels/bindings.ts`:

```ts
import { upsertAgentChannelBinding } from '@/lib/channels/bindings'

// Route every Slack message in #general to a specific agent
await upsertAgentChannelBinding({
  agentId: 'agent_…',
  channel: 'slack',
  externalKey: 'C0123456789', // Slack channel id
  kind: 'channel',
})

// Or: route a 1:1 DM to an agent
await upsertAgentChannelBinding({
  agentId: 'agent_…',
  channel: 'slack',
  externalKey: 'U0123456789', // Slack user id
  kind: 'dm',
})

// Or: a fallback for any thread without an explicit binding
await upsertAgentChannelBinding({
  agentId: 'agent_…',
  channel: 'slack',
  externalKey: '',
  kind: 'default',
})
```

Without any binding the bot will silently drop incoming events — this
is intentional so installing the app in a busy workspace doesn't cause
the agent to reply to unrelated chatter.

## Adding another channel

To support, e.g., Microsoft Teams:

1. `pnpm add @chat-adapter/teams` (or whichever official adapter).
2. Add `'teams'` to the `ChannelId` union in `lib/channels/types.ts`.
3. Create `lib/channels/teams/bot.ts` mirroring `slack/bot.ts`:
   construct a `Chat` instance, register handlers, and call
   `runChannelChatTurn` from `lib/channels/dispatch.ts` with the
   normalised message.
4. Add `app/api/channels/teams/events/route.ts` that delegates to the
   bot's `webhooks.teams(request, …)`.
5. Bind agents with `upsertAgentChannelBinding({ channel: 'teams', … })`.

The dispatch layer doesn't need to change — `runChannelChatTurn` is
channel-agnostic and writes through the existing chat persistence and
workflow code paths.

## Operational notes

- **State**: the Chat SDK uses `@chat-adapter/state-memory` by default
  here. Thread subscriptions and concurrency locks are best-effort and
  reset on cold start, but the canonical `chat_conversation` mapping
  lives in Postgres so message history is never lost. For multi-instance
  deployments, swap in `@chat-adapter/state-redis` and set `REDIS_URL`.
- **Slack 3-second ack**: the route uses Next.js's `after()` so the
  agent run continues after the webhook response is on the wire. Slack
  will not retry a long-running model turn.
- **Streaming**: `thread.post(asyncIterable)` lets the Slack adapter
  edit the message in place as text deltas arrive, giving the
  streaming-reply experience without managing rate limits manually.
- **Paused agents**: if the matched agent is disabled, the user is told
  to enable it from the dashboard rather than getting silence.
