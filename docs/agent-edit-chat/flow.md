# Agent Edit Chat Flow

Product behavior:
- Configure renders manual controls first, then "Assisted editing" with current settings, bootstrap markdown, and budget summary.
- The client posts to `/api/agents/[agentId]/edit/chat`; the app route delegates to the shared handler.
- The handler authenticates, checks ownership, validates `messages`, resolves the edit model, and loads tool visibility.
- The edit model runs with step limit 8 and a tool snapshot embedded in its instructions.
- Read tools expose current config, available tools, and current budget.
- Mutation tools update config, attach/detach tools, attach sub-agents, or set budget after approval.
- On finish, the client refreshes so manual controls reflect accepted changes.

Source anchors: `apps/app/app/agents/[agentId]/configure/page.tsx`, `packages/shared/agents/components/agent-edit-chat.tsx`, `apps/api/app/api/agents/[agentId]/edit/chat/route.ts`, `packages/shared/agents/api/edit-chat/route-handler.ts`.
