# Agent Management Invariants

Rules enforced in source:
- Every server action requires a session and scopes mutations to `(agent.id, agent.userId)`.
- Creation requires the selected inference provider to be enabled for the user.
- Creation falls back to the provider default model when the requested model is invalid; update rejects invalid provider/model changes.
- Heartbeat intervals are clamped to 5..1440 minutes and daily-time schedules are normalized for the selected mode.
- Non-admin creation limit checks run under a per-user Postgres advisory transaction lock.
- Idempotent creation uses `sha256(userId:toolCallId)` to derive a stable `ag_` id and may replay bootstrap writes.
- Update writes bootstrap files only when LF-normalized content differs from the original loaded content.

Source anchors: `packages/shared/agents/server/creation-service.ts`, `packages/shared/agents/server/update-service.ts`, `packages/shared/agents/server/actions.ts`, `packages/shared/agent-schedule.ts`.
