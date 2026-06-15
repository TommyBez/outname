# Adding Event Kinds

Scope: implementation checklist for adding or changing durable event types.

- Update DB enum values and shared event type unions before adding ingress.
- Add the payload shape in `shared/event-payload.ts`; workflow dispatch casts through `payloadAs`.
- Add summary preview and any UI labels in shared event summary/type helpers.
- Add a `dispatchAgentEvent` case and decide which handler owns terminal transcript persistence.
- If the event streams somewhere other than `reply:<eventId>`, update `outputNamespaceForAgentEvent`.
- If the handler uses `buildAgent`, add/confirm `AgentRuntimeEventKind` support.
- Choose `source`, idempotency key, and concurrency key at enqueue time.
- Scheduled events should use stable slot keys; manual events should use random idempotency.
- Keep workflow cleanup generic; resource cleanup belongs in `cleanupEventResources` or handler steps.
- Add tests for dispatch routing, namespace/transcript selection, key stability, and recovery behavior.

Source: `packages/db/schema/agents.ts`; `shared/event-payload.ts`; `server/agent-event-summaries.ts`; `workflows/agent-events/workflow.ts`; `workflows/session/runtime-spec-types.ts`.
Tests: `workflows/events/workflow.workflow.unit.test.ts`; `server/agent-event-transcript.test.ts`; `server/agent-event-keys.test.ts`; `server/agent-event-reconciliation.test.ts`.
