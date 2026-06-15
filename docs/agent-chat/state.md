# Agent Chat State

Persisted state:
- `chat_conversation` stores `id`, `agentId`, optional `title`, and `updatedAt`; sidebar ordering is newest first by agent.
- `chat_message` stores role, full AI SDK `parts` JSONB, metadata, and creation time.
- Chat history is loaded only after agent ownership and conversation ownership pass.
- In-app chat persists the newest user message before streaming; assistant output is persisted on realtime finish.
- Channel threads map to conversations in `channel_thread_conversations`, one external thread per agent.
- Provider/skipped/current channel messages are upserted into `chat_message` before the runner loads canonical Postgres history.
- Sub-agent tool outputs remain raw in persisted messages and are compacted only for model input.

Source anchors: `packages/db/schema/chat.ts`, `packages/db/schema/channels.ts`, `apps/app/app/agents/[agentId]/chat/[conversationId]/conversation-page-data.ts`, `packages/ai/chat/server/chat.ts`, `packages/ai/chat/server/chat-model.ts`, `packages/shared/channels/server/dispatch.ts`.
