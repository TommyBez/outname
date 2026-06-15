# Agent Management Tests

Covered:
- Non-admin users at the three-agent limit are blocked before insert, bootstrap writes, or summary refresh.
- Non-admin users below the limit can create; admins bypass the limit.
- Idempotent creation retries for an existing `ag_` id succeed even when the user is at the limit.
- Agent schedule normalization has focused tests outside this folder.

Test anchors: `packages/shared/agents/server/creation-service.test.ts`, `packages/shared/agent-schedule.test.ts`.

Known gaps:
- Pause/resume and delete server actions rely on source review and manual browser verification.
- Configure-page assisted edit behavior is covered through shared edit-chat sources, not a dedicated page test.
