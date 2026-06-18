# Agent Chat Invariants

Rules enforced in source:
- Conversation lookup, listing, rename, delete, and page data are always scoped to the agent id.
- User message inserts use `ON CONFLICT DO NOTHING`; duplicate ids do not touch `updatedAt`.
- Channel message ids hash channel, external scope, external message key, and agent id.
- A duplicate current channel message with unchanged content skips the runner.
- Title generation only updates null or placeholder `New Chat` titles.
- Greeting-only first turns do not generate a title; the first substantive user message seeds the title.
- Rename trims to 80 characters and rejects empty titles before updating.

Source anchors: `packages/ai/chat/server/chat.ts`, `packages/ai/chat/server/actions.ts`, `packages/ai/chat/workflows/steps/generate-conversation-title.ts`, `packages/shared/channels/server/dispatch.ts`.
