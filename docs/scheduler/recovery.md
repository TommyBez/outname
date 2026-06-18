# Scheduler Recovery

Scope: liveness repair rules before queued work is started.

- Expired `starting` rows are `starting` with null or past `claimExpiresAt`, limit 50.
- Recovery first reconciles the row against the workflow run status.
- If a starting workflow is alive, reconciliation promotes the event to `running`.
- If the workflow is terminal, reconciliation marks the event `completed` or `failed`.
- If the row is still `starting` and no workflow is alive, scheduler resets it to `queued`.
- Reset error is `starting claim expired before workflow became healthy`.
- Running recovery scans `running` rows by `startedAt`, limit 100.
- Workflow `completed` marks event `completed`; `failed|cancelled` marks event `failed`.
- Workflow `not_found` marks the event `completed` to tolerate vanished durable runs.
- If workflow status is unknown but heartbeat is older than 90m, event is marked `failed`.
- Stream route also reconciles active rows before returning 503 for missing workflow runs.
- Event workflow `finally` runs cleanup and starts the next queued same-concurrency event.

Source: `server/event-scheduler.ts`; `server/agent-event-reconciliation.ts`; `server/agent-event-store.ts`; `apps/api/app/api/agents/[agentId]/events/[eventId]/stream/route.ts`.
Tests: `server/agent-event-reconciliation.test.ts`; `workflows/events/workflow.workflow.unit.test.ts`; `apps/api/app/api/agents/[agentId]/events/[eventId]/stream/route.test.ts`.
