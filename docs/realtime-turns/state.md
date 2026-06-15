# Realtime Turns State

State model:
- `runId` is threaded through tool runtime context, assistant metadata, budget refusal ids, and usage logs.
- Runtime spec carries agent name, provider/model, user id, step limit, system prompt, skill plan, and tool plan.
- System sandbox and file cache must exist before composing runtime tools.
- UI mode persists full assistant `UIMessage.parts`; text-only mode persists one assistant text part with source/run metadata.
- Budget refusal persists a synthetic assistant message id `budget_refusal_${runId}`.
- Usage recording is scheduled from model finish events with `sourceType: chat` and `sourceId: conversationId`.

Source anchors: `packages/ai/agent-runtime/server/realtime-chat-runner.ts`, `packages/ai/agent-runtime/server/runtime-spec.ts`, `packages/ai/agent-runtime/server/realtime-agent-runtime.ts`, `packages/db/schema/chat.ts`.
