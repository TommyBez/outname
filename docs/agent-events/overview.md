# Agent Events

Scope: durable ledger for heartbeat, dreaming, and invocation; realtime chat is outside except when it enqueues invocations.

## Flow
1. Ingress inserts or reuses a `queued` row by idempotency key.
2. Start ignores future/nonqueued rows, then claims due rows for 5 minutes.
3. Workflow marks `running`, dispatches by type, then marks terminal.
4. `finally` cleans run sandboxes/cache and starts the next row sharing the concurrency key.

## State
- Statuses: `queued` -> `starting` -> `running` -> `completed`/`failed`/`cancelled`.
- `starting` has `claimExpiresAt`; `running` has `workflowRunId` and `heartbeatAt`.
- Summaries reconcile active rows and expose `blockedByEventId`.

## Invariants
- Idempotency keys dedupe ingress; concurrency keys permit one active row per key.
- Output is `reply:<eventId>` except invocation `streamToken`; activity is `events:<runId>`.
- Terminal events with workflow run ids should have persisted transcript rows.

## Failure Modes
- Workflow start failure resets `starting` to `queued`.
- Scheduler fails running rows after 90 minutes without heartbeat.
- Missing persisted terminal transcript returns 409 on transcript route.

## Anchors
- `apps/api/app/api/agents/[agentId]/events/route.ts`, `.../[eventId]/stream/route.ts`
- `packages/ai/agent-runtime/server/agent-event-store.ts`, `agent-event-start.ts`
- `packages/ai/agent-runtime/server/agent-event-transcript.ts`
- `packages/ai/agent-runtime/workflows/agent-events/workflow.ts`
