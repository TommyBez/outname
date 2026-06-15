# Schedule Contract

Scope: cron-created durable heartbeat and dreaming events.

- `GET /api/cron/liveness` requires `Authorization: Bearer $CRON_SECRET`.
- Missing `CRON_SECRET` returns 500; bad bearer returns 401.
- `AGENT_SCHEDULER_CRON_ENABLED=false` returns ok with `skipped`.
- Cron work runs under Redis lock `agent-events:scheduler:liveness` with 240s TTL.
- Pass order is enqueue due, recover expired `starting`, recover `running`, start queued.
- Only `agent.enabled=true` rows are considered for scheduled events.
- Heartbeat requires `heartbeatEnabled`; dreaming requires `dreamingEnabled`.
- Daily heartbeat uses the latest local slot `<= now`; it skips when `lastHeartbeatAt >= scheduledFor`.
- Interval heartbeat skips until `now - lastHeartbeatAt >= heartbeatIntervalMinutes`.
- Dreaming runs once per owner local date using `lastDreamingLocalDate`.
- Scheduled idempotency and concurrency key are identical `sched:...` values.
- Queue start reads due `queued` rows by `queuedAt asc`, limit 100.

Source: `apps/api/app/api/cron/liveness/route.ts`; `server/event-scheduler.ts`; `server/schedule-due.ts`; `server/agent-event-keys.ts`.
Tests: `server/schedule-due.test.ts`; `server/agent-event-keys.test.ts`; `server/agent-event-reconciliation.test.ts`.
