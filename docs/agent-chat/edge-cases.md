# Agent Chat Edge Cases

Failure modes:
- Chat POST returns 401 unauthenticated, 404 wrong owner, 412 paused agent, or 400 for invalid JSON/messages/conversation id.
- A paused channel-bound agent posts an error notice instead of running.
- Sidebar optimistic rows are rolled back or kept by revalidating after chat errors.
- Assistant partials are not persisted when realtime finish is aborted or errored.
- Provider-history import failures warn and continue with available messages.
- Channel stream post failures post an agent failure notice and continue remaining routed agents.
- Deleting the active conversation redirects to `/agents/[agentId]/chat`.

Source anchors: `apps/api/app/api/agents/[agentId]/chat/route.ts`, `packages/ai/chat/components/agent-chat.tsx`, `packages/ai/agent-runtime/server/realtime-chat-runner.ts`, `packages/shared/channels/server/dispatch.ts`, `packages/ai/chat/server/actions.ts`.
