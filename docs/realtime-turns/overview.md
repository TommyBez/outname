# Realtime Turns

Scope: chat-style agent turns used by in-app chat and channels.

Read this folder as:
- [Flow](flow.md): UI-mode and text-only turn sequence.
- [Runtime spec](runtime-spec.md): spec inputs, loaded plans, prompt composition, and runtime consumers.
- [State](state.md): run ids, metadata, persisted assistant messages, refusals, and usage observations.
- [Invariants](invariants.md): ownership ordering, budget refusal, sandbox-before-spec, persistence policy, and cleanup.
- [Edge cases](edge-cases.md): missing agents, owner mismatch, refused budgets, dropped partials, and background failures.
- [Tests](tests.md): runner persistence, ordering, refusal, ownership, and stream-failure coverage.

Primary source anchors: `packages/ai/agent-runtime/server/realtime-chat-runner.ts`, `packages/ai/agent-runtime/server/runtime-spec.ts`, `packages/ai/agent-runtime/server/realtime-agent-runtime.ts`.
