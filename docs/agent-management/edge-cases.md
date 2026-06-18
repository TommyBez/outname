# Agent Management Edge Cases

Failure modes:
- New-agent buttons show an "Agent limit reached" dialog before navigation when `canCreate` is false.
- The creation service still enforces the limit, so races or bypassed UI return `AgentCreationLimitExceededError`.
- Missing provider credentials reject creation/update with "Selected inference provider is not configured."
- A paused agent remains visible in the registry, but chat rejects new turns and channel dispatch posts a paused-agent notice.
- If delete cannot find an owned agent, it redirects to `/agents`.
- Delete marks all `agent_events` for the agent as `cancelled` with `lastError: agent deleted`.
- Sandbox cleanup is attempted before deleting the row; cleanup errors can block the action because they are awaited.

Source anchors: `packages/shared/agents/components/new-agent-link.tsx`, `packages/shared/agents/server/actions.ts`, `apps/api/app/api/agents/[agentId]/chat/route.ts`, `packages/shared/channels/server/dispatch.ts`.
