# Concurrency And Idempotency

Scope: duplicate suppression and single-active-run guarantees for durable events.

- `agent_events_idempotency_idx` is unique on `idempotency_key`.
- `agent_events_active_concurrency_idx` is unique for non-null `concurrency_key` while status is `starting|running`.
- Enqueue uses `onConflictDoNothing`; a duplicate idempotency key resolves to the existing event.
- Claim checks active rows for the same key and treats Postgres `23505` as a lost race.
- Scheduled heartbeat/dreaming use the same `sched:...` value for idempotency and concurrency.
- Interval key: `sched:<agentId>:<type>:<bucket>`, where bucket is `floor(now / intervalMs)`.
- Daily key: `sched:<agentId>:<type>:daily:<localDate>:<HHmm>`.
- Manual heartbeat/dreaming use `manual:<agentId>:<type>:<nanoid>` and `concurrencyKey: null`.
- Invocation idempotency is `invocation:<childId>:<parentRunId|root>:<toolCallId|streamToken>`.
- Invocation rows currently have no concurrency key; parent retry handles a queued child with no run id.
- `blockedByEventId` is a summary-only lookup from queued rows to active same-key rows.
- Workflow `finally` starts the next due queued row for the same concurrency key in `queuedAt` order.

Source: `packages/db/schema/agents.ts`; `server/agent-event-keys.ts`; `server/session-events.ts`; `server/agent-invocation-events.ts`; `server/agent-event-summaries.ts`.
Tests: `server/agent-event-keys.test.ts`; `server/agent-invocation-events.step.unit.test.ts`; `workflows/events/workflow.workflow.unit.test.ts`.
