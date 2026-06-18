# Heartbeat

Scope: durable normal autonomous check-in; realtime chat uses the separate chat runner.

## Flow
- Scheduler enqueues enabled agents with `heartbeatEnabled`; manual trigger requires owner/enabled agent.
- Scheduled rows share idempotency/concurrency key; manual rows use random idempotency and no concurrency.
- Due rows enter `handleHeartbeat` mode `normal`, preflight budget, start sandbox, build runtime.
- Success records heartbeat usage, finalizes, updates `lastHeartbeatAt`, and persists transcript.

## State
- Due rules are `daily_times` by owner timezone or interval from `lastHeartbeatAt`.
- Future scheduled rows remain queued; workflow state is held in `agent_events`.
- Kickoff constrains the agent to one small useful action and log update.

## Invariants
- Disabled agents are rejected manually and skipped by scheduler.
- Budget refusal completes event/transcript but does not advance `lastHeartbeatAt`.
- Scheduled idempotency prevents duplicate rows within a daily slot or interval bucket.

## Failure Modes
- Missing/foreign/disabled manual target returns 401/404/412.
- Budget exceeded returns assistant refusal transcript.
- Model/runtime failure marks run failed; event workflow marks event failed.

## Anchors
- `apps/api/app/api/agents/[agentId]/trigger/route.ts`
- `packages/ai/agent-runtime/server/event-scheduler.ts`
- `packages/ai/agent-runtime/workflows/session/handlers/handle-heartbeat.ts`
- `packages/ai/agent-runtime/workflows/session/steps/db/agent-schedule.ts`
