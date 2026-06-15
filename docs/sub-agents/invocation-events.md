# Invocation Events

Scope: sub-agent tools that enqueue durable `invocation` events.

- Tool planning rejects deleted, foreign, disabled, cyclic, or depth-over-3 children as reconnects.
- Legacy or duplicate sub-agent tool ids are renamed before runtime exposure.
- Tool input is one self-contained `instruction` string from 1 to 8000 chars.
- Realtime parents start `agentEventWorkflow`; workflow parents start the current workflow id.
- Dispatch rechecks child ownership and enabled state before enqueueing.
- Payload stores instruction, `streamToken`, call stack, depth, and parent run/tool references.
- Idempotency key is `invocation:<childId>:<parentRunId|root>:<toolCallId|streamToken>`.
- If enqueue returns no workflow run id, dispatch throws `RetryableError` with `retryAfter: 1s`.
- Child output namespace is `streamToken`; parent collector tails from `startIndex: 0`.
- Budget/runtime failures write stream error plus finish so the parent collector can settle.
- Parent tool returns failed output on stream error or no final assistant text.
- Child event cleanup is handled by the agent-event workflow `finally` block.

Source: `workflows/session/steps/resolve-tool-plan/sub-agents.ts`; `server/agent-invocation-events.ts`; `tools/sub-agents/*.ts`; `workflows/session/handlers/handle-invocation.ts`.
Tests: `server/agent-invocation-events.step.unit.test.ts`; `tools/sub-agents/realtime-agent-tool.unit.test.ts`; `tools/sub-agents/workflow-agent-tool.unit.test.ts`; `tools/sub-agents/invocation-stream.test.ts`.
