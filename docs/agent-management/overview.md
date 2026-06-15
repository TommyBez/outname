# Agent Management

Scope: user-owned `agent` rows, configuration surfaces, bootstrap markdown, lifecycle controls, shell navigation, cache revalidation, and sandbox cleanup.

Read this folder as:
- [Flow](flow.md): registry, configure, pause/resume, and delete behavior.
- [Product shell](product-shell.md): layout, sidebar, tabs, triggers, and command palette.
- [Configuration contract](configuration-contract.md): form state, save payloads, provider/model rules, and bootstrap mapping.
- [State](state.md): persisted agent fields, bootstrap files, budgets, and cascades.
- [Invariants](invariants.md): ownership, provider/model, schedule, creation limit, and bootstrap write rules.
- [Edge cases](edge-cases.md): limit, paused, provider, deletion, and cleanup failures.
- [Tests](tests.md): source-backed coverage and known manual gaps.

Primary source anchors: `apps/app/app/(app)/agents/page.tsx`, `apps/app/app/agents/[agentId]/layout.tsx`, `apps/app/app/agents/[agentId]/configure/page.tsx`, `packages/shared/agents/server/actions.ts`.
