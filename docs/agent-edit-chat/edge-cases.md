# Agent Edit Chat Edge Cases

Failure modes:
- Unauthenticated requests return 401.
- Missing or wrong-owner agents return 404 before message parsing reaches model execution.
- Invalid JSON or a non-array `messages` body returns 400.
- Missing default inference provider fails before the edit model can run.
- Invalid provider/model changes throw from `updateAgentForUser`.
- Attach/detach operations return result objects; failures do not mutate unrelated configuration.
- Denied approval produces no mutation because AI SDK approval is the consent boundary.

Source anchors: `packages/shared/agents/api/edit-chat/route-handler.ts`, `packages/shared/agents/server/update-service.ts`, `packages/shared/agents/components/agent-edit-chat/tool-parts.tsx`, `packages/shared/agents/api/edit-chat/budget-tools.ts`.
