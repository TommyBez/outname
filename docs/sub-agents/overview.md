# Sub-Agents

Scope: delegation tools bridge realtime or durable parent turns into durable invocation events.

## Flow
- Attach route requires session; planning reconnects deleted/foreign/disabled/cyclic/too-deep children.
- Parent tool accepts self-contained `instruction` of 1..8000 chars and emits preliminary output.
- Dispatch enqueues invocation event; parent tails `streamToken` until final text/failure.

## State
- Max depth is 3; `callStack` carries lineage and root budget identity.
- Runtime tool ids use `agent_` and rename legacy/duplicate ids.
- Payload stores input, `streamToken`, `callStack`, depth, and parent run/tool ids.

## Boundary
- Realtime parent uses `buildRealtimeAgentTool` and starts `agentEventWorkflow`.
- Durable parent uses `buildWorkflowAgentTool` and starts the current workflow id.
- Child has its own sandbox and cannot see parent memory/files unless instruction includes them.

## Invariants
- Dispatch rechecks child ownership and enabled state.
- Idempotency key is child + parent run/root + tool call or stream token.
- Child output namespace is `streamToken`; parent progress target is best-effort UX.

## Failure Modes
- Stream error or no final assistant text returns failed `sub_agent` output.
- Budget refusal writes error chunk, closes stream, and persists refusal transcript.
## Anchors
- `apps/api/app/api/agents/[agentId]/sub-agents/[childAgentId]/route.ts`; `packages/ai/tools/sub-agents/agent-tool.ts`
- `packages/ai/tools/sub-agents/realtime-agent-tool.ts`, `workflow-agent-tool.ts`; `server/agent-invocation-events.ts`; `handle-invocation.ts`
