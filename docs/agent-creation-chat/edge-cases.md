# Agent Creation Chat Edge Cases

Failure modes:
- Unauthenticated requests return 401.
- Invalid JSON or a non-array `messages` body returns 400.
- Missing default inference credentials return 428 with `inference_provider_missing`.
- Daily-time heartbeat creation requires at least one `HH:mm` time when enabled.
- Creation-service provider, model, and limit failures surface through the tool call output.
- Tool attachment failures do not roll back the created agent; they are returned per attachment.
- Budget-rule persistence errors are logged and do not fail agent creation.

Source anchors: `packages/shared/agents/api/creation-chat/route-handler.ts`, `packages/shared/agents/api/creation-chat/schemas.ts`, `packages/shared/agents/api/creation-chat/create-requested-agent.ts`, `packages/shared/agents/server/creation-service.ts`.
