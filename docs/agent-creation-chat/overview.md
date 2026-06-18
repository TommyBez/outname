# Agent Creation Chat

Scope: ephemeral AI SDK chat on `/agents/new` that guides an operator to a reviewed agent configuration.

Read this folder as:
- [Flow](flow.md): page, route, creator tools, budget widget, and approval UI.
- [State](state.md): ephemeral transcript, tool parts, persisted creation output, attachments, and budgets.
- [Invariants](invariants.md): exact ids, provider/model choice, budget round-trip, and approval consent.
- [Edge cases](edge-cases.md): auth, malformed input, missing credentials, schema failures, and partial attachment failures.
- [Tests](tests.md): covered lower layers and manual verification anchors.

Primary source anchors: `apps/app/app/(app)/agents/new/page.tsx`, `packages/shared/agents/components/agent-creation-chat.tsx`, `packages/shared/agents/api/creation-chat/route-handler.ts`.
