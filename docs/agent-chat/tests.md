# Agent Chat Tests

Covered:
- `insertChatMessageIfNew` returns false and skips `updatedAt` on duplicate ids.
- Concurrent duplicate inserts rely on `ON CONFLICT DO NOTHING RETURNING id`.
- `upsertChatMessage` updates changed provider messages and returns `unchanged` for equivalent JSON.
- Conversation page data loads history only after agent and conversation ownership checks.
- Title generation skips greetings, replaces placeholder `New Chat`, and falls back when the model returns `New Chat`.

Test anchors: `packages/ai/chat/server/chat.test.ts`, `apps/app/app/agents/[agentId]/chat/[conversationId]/conversation-page-data.test.ts`, `packages/ai/chat/workflows/steps/generate-conversation-title.test.ts`.

Known gap: chat route status codes and sidebar UI interactions need manual browser verification.
