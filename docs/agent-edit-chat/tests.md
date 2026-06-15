# Agent Edit Chat Tests

Covered by lower layers:
- Schedule normalization and shared creation/update constraints are tested where those helpers live.
- Budget-rule application is source-only in this area; no focused edit-chat budget test exists.
- Tool visibility and approval UI are source-reviewed and need manual browser verification for regressions.

Test anchors: `packages/shared/agent-schedule.test.ts`.

Manual anchors:
- `apps/app/app/agents/[agentId]/configure/page.tsx`
- `packages/shared/agents/components/agent-edit-chat.tsx`
- `packages/shared/agents/api/edit-chat/route-handler.ts`
