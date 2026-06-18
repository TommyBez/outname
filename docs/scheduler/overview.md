# Scheduler And Liveness

Scope: cron-only durable maintainer; it does not run realtime chat turns.

## Flow
- `GET /api/cron/liveness` requires bearer `CRON_SECRET`, enabled flag, and Redis lock.
- Pass order: enqueue due, recover expired `starting`, recover `running`, start queued.
- Queued start uses `queuedAt` order, due `scheduledFor`, limit 100.

## State
- Scheduled heartbeat/dreaming keys are both idempotency and concurrency keys.
- Starting claims last 5 minutes; active statuses are `starting`/`running`.
- Running health is workflow status plus agent-event `heartbeatAt`.

## Invariants
- Only enabled agents produce scheduled rows.
- One active scheduled row per concurrency key; next row starts after workflow cleanup.
- `AGENT_SCHEDULER_CRON_ENABLED=false` and lock contention return skipped ok.

## Failure Modes
- Missing `CRON_SECRET` is 500; bad bearer is 401.
- Expired `starting` with no live workflow resets to queued.
- Running rows fail after 90 minutes without heartbeat.
- Workflow failed/cancelled marks event failed; missing workflow run marks completed.

## Anchors
- `apps/api/app/api/cron/liveness/route.ts`
- `packages/ai/agent-runtime/server/event-scheduler.ts`
- `packages/ai/agent-runtime/server/agent-event-reconciliation.ts`
- `packages/ai/agent-runtime/server/schedule-due.ts`
