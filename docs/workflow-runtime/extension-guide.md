# Extension Guide

Scope: adding durable workflow-backed behavior through `@outname/workflow`.

- Import `start/getRun` from `@outname/workflow/api`, not the upstream SDK.
- Import metadata, streams, `FatalError`, and `RetryableError` from `@outname/workflow/runtime`.
- Workflow entry functions must contain `"use workflow"`; DB/API helpers that run durably use `"use step"`.
- Starters call `start(workflow, args)`, persist `runId`, then readers use `getRun(runId)`.
- Do not synthesize run ids; use `currentWorkflowRunId()` or the `start(...)` result.
- Call `getWorkflowMetadata()` and `getWritable()` only from workflow/step paths.
- Stream namespaces must be explicit: output `reply:<eventId>` or token, activity `events:<runId>`.
- Progress writes are best-effort unless the handler explicitly fails the run.
- Use `FatalError`/`nonRetryableStepError` for errors the workflow should not retry.
- Use `RetryableError`/`delayedRetryStepError` for transient gaps, including `retryAfter`.
- Agent-event workflows always run cleanup in `finally` and then hand off same-key queued work.
- New run resources should be tagged by `runId` or cleaned by `cleanupEventResources`.

Source: `packages/workflow/api.ts`; `packages/workflow/runtime.ts`; `packages/shared/server/workflow-step-errors.ts`; `workflows/agent-events/workflow.ts`; `workflows/events/steps/cleanup-event.ts`.
Tests: `workflows/events/workflow.workflow.unit.test.ts`; `server/agent-invocation-events.step.unit.test.ts`; `tools/sub-agents/invocation-stream.test.ts`; `apps/api/app/api/agents/[agentId]/events/[eventId]/stream/route.test.ts`.
