# Realtime Turns Tests

Covered:
- `tapFullStream` yields original chunks once and accumulates visible text deltas.
- UI mode persists normal and length-finished assistant messages, then schedules title generation.
- Aborted and errored UI assistant partials are dropped.
- Budget refusal avoids model startup, usage recording, and title generation.
- Ownership is validated before budget and sandbox startup; missing agents have a distinct error.
- System sandbox startup happens before runtime spec composition.
- Text-only mode persists accumulated text with run/source metadata and does not persist partial text when channel posting fails.

Test anchors: `packages/ai/agent-runtime/server/realtime-chat-runner.test.ts`.
