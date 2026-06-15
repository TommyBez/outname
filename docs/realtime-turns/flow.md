# Realtime Turns Flow

Product behavior:
- In-app chat calls realtime with `persistMode: ui-message-full`; channels call it with `persistMode: text-only`.
- Inputs include agent, user, conversation, run id, source, abort signal, optional external thread ids, and a delivery adapter.
- Preparation loads the agent, checks ownership, preflights budget, starts the system sandbox, then builds a chat runtime spec.
- UI mode creates an AI SDK UI-message stream and writes status/tool chunks to the client.
- Text-only mode streams model chunks through the channel sink and separately accumulates visible text.
- On finish, output persistence, list revalidation, usage recording, cleanup, and title generation run through runner policies.

Source anchors: `apps/api/app/api/agents/[agentId]/chat/route.ts`, `packages/shared/channels/server/dispatch.ts`, `packages/ai/agent-runtime/server/realtime-chat-runner.ts`, `packages/ai/agent-runtime/server/realtime-agent-runtime.ts`.
