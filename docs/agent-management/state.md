# Agent Management State

Persisted state:
- `agent` owns name, enabled flag, provider/model, step-limit mode/custom value, heartbeat cadence, dreaming flag, capability summary, and sandbox ids.
- `sandboxSystemId` is the persistent system sandbox name; `sandboxSkillsId` is filled after skill installation.
- Bootstrap markdown lives in agent memory files: `IDENTITY.md`, `SOUL.md`, `AGENTS.md`, and `USER.md`.
- Configure shows only the custom instruction block extracted from `AGENTS.md`, not the full platform template.
- Budget rules are scoped by user and agent; configure summarizes them beside manual and assisted editing.
- Deleting an agent cascades dependent chat/channel rows through DB references after the agent row is removed.

Source anchors: `packages/db/schema/agents.ts`, `packages/shared/agents/server/bootstrap-files.ts`, `packages/shared/agents/server/creation-service.ts`, `packages/shared/agents/server/update-service.ts`, `packages/db/schema/chat.ts`, `packages/db/schema/channels.ts`.
