# Agent Edit Chat State

State model:
- The edit transcript is in-memory only and guarded against reload while a request is busy.
- Current config loads the owned agent plus `IDENTITY.md`, `SOUL.md`, `AGENTS.md`, and `USER.md`.
- `AGENTS.md` is reduced to the custom instruction block before entering the edit prompt.
- `apply_agent_edit` reloads current bootstrap contents and passes originals to the update service.
- Budget state is daily/weekly/monthly USD caps; `null` clears a cap in `set_agent_budget`.
- Tool visibility includes attached tools, removed-from-catalog tools, connector statuses, config fields, and sub-agent candidates.

Source anchors: `packages/shared/agents/api/edit-chat/current-config.ts`, `packages/shared/agents/api/edit-chat/budget-tools.ts`, `packages/shared/agents/api/edit-chat/tool-visibility.ts`, `packages/shared/agents/server/update-service.ts`.
