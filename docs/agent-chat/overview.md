# Agent Chat

Scope: multi-conversation transcripts for one agent across in-app chat and channel thread mappings.

Read this folder as:
- [Flow](flow.md): redirects, draft promotion, chat POST, streaming, and sidebar behavior.
- [API contract](api-contract.md): request bodies, status codes, conversation list, and actions.
- [State](state.md): chat tables, channel thread mapping, history loading, and compacted model input.
- [Invariants](invariants.md): agent scoping, idempotent ids, title generation, and rename limits.
- [Edge cases](edge-cases.md): paused agents, optimistic rollback, partial drops, provider history, and channel failures.
- [Tests](tests.md): persistence, ownership, and title-generation coverage.

Primary source anchors: `apps/api/app/api/agents/[agentId]/chat/route.ts`, `packages/ai/chat/server/chat.ts`, `packages/ai/chat/components/agent-chat.tsx`.
