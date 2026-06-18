# Agent Management Flow

Product behavior:
- `/agents` requires a session, loads cached agents plus user timezone, and gates New Agent with `canCreateAgentForUser`.
- Registry search filters by name, model, active/paused state, heartbeat state, and dreaming state; Enter opens the first match.
- Registry rows route directly to overview, chat, configure, and tools.
- Configure loads the owned agent, bootstrap files, enabled providers, available models, Slack bindings, and budget rules.
- Manual form updates and assisted edit chat both end at `updateAgentForUser`.
- Pause/resume flips `agent.enabled`, refreshes the registry/agent pages, and shows a toast.
- Delete verifies ownership, marks the agent's event rows cancelled, tries sandbox cleanup, deletes the agent row, then redirects to `/agents`.

Source anchors: `apps/app/app/(app)/agents/page.tsx`, `apps/app/app/agents/[agentId]/configure/page.tsx`, `packages/shared/agents/components/agent-registry.tsx`, `packages/shared/agents/server/actions.ts`.
