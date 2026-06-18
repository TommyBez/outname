# Dreaming

Scope: durable reflection mode on heartbeat handler; realtime chat is separate and does not schedule dreaming.

## Flow
- Scheduler enqueues enabled agents with `dreamingEnabled` once per owner local date.
- Manual trigger mode `dreaming` requires owner/enabled agent and uses the user's local date.
- Dispatch calls `handleHeartbeat` mode `dreaming` with `localDate` and reply namespace.
- Success records dreaming usage, updates `lastDreamingAt`/local date, and persists transcript.

## State
- Scheduler computes local date from user timezone and key `sched:<agent>:dreaming:daily:<date>:0000`.
- Previous completion is `lastDreamingAt`; duplicate prevention is `lastDreamingLocalDate`.
- Prompt asks for logs plus `DREAMS.md`, `GOALS.md`, and `TASKS.md` evidence.

## Invariants
- Timezone local date, not UTC date, controls once-per-day scheduling.
- `dreamingEnabled` gates scheduler only; `enabled` is the top-level runnable gate.
- Budget refusal still marks the local date completed to avoid same-day loops.

## Failure Modes
- Missing/foreign/disabled manual target returns 401/404/412.
- Budget exceeded writes refusal transcript and skips model work.
- Runtime failure follows heartbeat failure path and marks event failed.

## Anchors
- `apps/api/app/api/agents/[agentId]/trigger/route.ts`
- `packages/ai/agent-runtime/server/event-scheduler.ts`, `schedule-due.ts`
- `packages/ai/agent-runtime/workflows/session/handlers/handle-heartbeat.ts`
- `packages/ai/agent-runtime/workflows/session/steps/db/agent-schedule.ts`
