# Agent Chat Flow

Product behavior:
- `/agents/[agentId]/chat` requires ownership and redirects to the most recent conversation or `/chat/new`.
- `/chat/new` creates a `cc_` draft id and keeps it DB-free until the first send.
- `AgentChat` posts `messages` plus `conversationId` to `/api/agents/[agentId]/chat`.
- The route authenticates, checks ownership and `enabled`, creates or finds the conversation, then idempotently inserts the newest user message.
- The realtime runner streams the assistant response back into `useChat`.
- Draft URLs are promoted with `history.replaceState` after the first message so the chat surface does not remount.
- The sidebar lists chats through SWR, supports optimistic first-row insertion, rename, delete, and title-refresh retries.

Source anchors: `apps/app/app/agents/[agentId]/chat/page.tsx`, `apps/app/app/agents/[agentId]/chat/new/page.tsx`, `apps/api/app/api/agents/[agentId]/chat/route.ts`, `packages/ai/chat/components/agent-chat.tsx`.
