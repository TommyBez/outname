# Agent Chat API Contract

Route contract:
- Chat POST body is `{ messages, conversationId }`; `messages` must be a non-empty array.
- `conversationId` must be a string 3..64 chars; draft ids are normally `cc_...`.
- The route returns 401 unauthenticated, 404 wrong owner, 412 paused agent, and 400 for invalid body.
- Before streaming, the route creates/fetches the agent-scoped conversation and inserts only the latest user message.
- The realtime call uses `runId: rt_${crypto.randomUUID()}`, `source: chat`, `persistMode: ui-message-full`, and `buildRealtimeAgentTool`.
- Conversation list GET returns `{ id, title, updatedAt }[]` with ISO `updatedAt`.
- Sidebar fetches the list with `cache: no-store`; server cache uses `conversationListTag(agentId)`.
- Rename/delete actions require session, agent ownership, and conversation ownership.

Source anchors: `apps/api/app/api/agents/[agentId]/chat/route.ts`, `apps/api/app/api/agents/[agentId]/conversations/route.ts`, `packages/ai/chat/components/agent-sidebar-workspace/conversations.ts`, `packages/ai/chat/server/actions.ts`.
