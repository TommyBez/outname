# Agent Edit Chat

Scope: ephemeral assisted-editing chat inside configure for one owned agent.

Read this folder as:
- [Flow](flow.md): configure surface, route handler, read tools, and approval-gated mutations.
- [State](state.md): current config, bootstrap extraction, budgets, and tool visibility.
- [Invariants](invariants.md): canonical manual controls, exact tool ids, budget round-trip, and update validation.
- [Edge cases](edge-cases.md): auth, ownership, malformed input, provider/model failures, and denied approvals.
- [Tests](tests.md): lower-layer coverage and manual verification anchors.

Primary source anchors: `apps/app/app/agents/[agentId]/configure/page.tsx`, `packages/shared/agents/components/agent-edit-chat.tsx`, `packages/shared/agents/api/edit-chat/route-handler.ts`.
