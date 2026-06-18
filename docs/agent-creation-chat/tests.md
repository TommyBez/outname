# Agent Creation Chat Tests

Covered by lower layers:
- Creation limit enforcement and idempotent `toolCallId` retries are tested in the creation service.
- Schedule parsing/normalization has shared schedule tests.
- Attachment, budget widget, and approval-card behavior currently rely on source review and manual browser verification.

Test anchors: `packages/shared/agents/server/creation-service.test.ts`, `packages/shared/agent-schedule.test.ts`.

Manual anchors:
- `apps/app/app/(app)/agents/new/page.tsx`
- `packages/shared/agents/components/agent-creation-chat.tsx`
- `packages/shared/agents/components/agent-creation-chat/create-agent-tool-card.tsx`
