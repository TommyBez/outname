# Agent Creation Chat Flow

Product behavior:
- `/agents/new` requires a session, loads the user's timezone, and renders an empty in-memory chat.
- The client posts `messages` to `/api/agent-creation/chat`; the app route delegates to the shared handler.
- The handler authenticates, validates `messages`, resolves enabled providers, and runs the creator model with step limit 8.
- Read tool `list_available_tools` returns maintainer tools, connector states, exposed tools, config fields, and existing sub-agents.
- `propose_agent_budget` renders an editable budget widget; the widget sends a follow-up message with the chosen values.
- `create_requested_agent` is approval-gated and renders a final configuration card before database mutation.
- On finish the client refreshes the page; success output links to overview, configure, and tools.

Source anchors: `apps/app/app/(app)/agents/new/page.tsx`, `packages/shared/agents/components/agent-creation-chat.tsx`, `apps/api/app/api/agent-creation/chat/route.ts`, `packages/shared/agents/api/creation-chat/route-handler.ts`.
