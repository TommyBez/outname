# Agent Event State Machine

Scope: durable rows in `agent_events`; realtime chat is outside this ledger.

- Statuses are `queued`, `starting`, `running`, `completed`, `failed`, `cancelled`.
- Insert path creates `queued`; idempotency conflicts return the existing row.
- `queued -> starting`: `claimQueuedEvent` requires due time and no active same concurrency key.
- Claim increments `attempt`, sets `startedAt`, `claimExpiresAt` to +5m, and clears `lastError`/`workflowRunId`.
- `starting -> running`: event workflow calls `markEventRunning`, clears claim, sets `workflowRunId`, `heartbeatAt`, `startedAt`.
- `starting -> queued`: starter failure or expired claim without a live workflow calls `resetStartingEvent`.
- `running -> completed`: dispatch returns and workflow marks terminal `completed`.
- `starting|running -> failed`: workflow catch marks `failed`; reconciliation maps workflow `failed|cancelled` to failed.
- `running -> failed`: reconciliation fails stale rows after 90m without `heartbeatAt` progress.
- `starting|running -> completed`: reconciliation maps workflow `completed` or missing run `not_found` to completed.
- Active statuses are only `starting` and `running`; terminal statuses are `completed`, `failed`, `cancelled`.
- Missing/non-active rows make `agentEventWorkflow` return before cleanup or queue handoff.

Source: `packages/db/schema/agents.ts`; `server/agent-event-start.ts`; `server/agent-event-store.ts`; `server/agent-event-reconciliation.ts`; `workflows/agent-events/workflow.ts`.
Tests: `server/agent-event-reconciliation.test.ts`; `workflows/events/workflow.workflow.unit.test.ts`; `server/agent-event-workflow-starter.unit.test.ts`.
