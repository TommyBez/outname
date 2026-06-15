# Agent Edit Chat Invariants

Rules enforced in source:
- Manual controls remain canonical; assisted chat uses the same update service and cache invalidation surfaces.
- Normal config changes require approval through `apply_agent_edit`.
- Attach/detach operations must use exact ids from `get_available_agent_tools`; sub-agent candidates exclude the current agent.
- Connector-backed tools can be pre-wired while missing/invalid connections are disclosed to the user.
- Budget edits read current caps when unknown, call `propose_agent_budget` once, wait for widget follow-up, then call `set_agent_budget`.
- Provider/model changes are validated unless both values are unchanged from the current row.
- Bootstrap writes happen only for LF-normalized fields that changed.

Source anchors: `packages/shared/agents/api/edit-chat/tool-visibility.ts`, `packages/shared/agents/api/edit-chat/route-handler.ts`, `packages/shared/agents/components/agent-edit-chat/budget-preview.tsx`, `packages/shared/agents/server/update-service.ts`.
