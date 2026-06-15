# Workflow Runtime

Scope/boundary: Workflow runtime is the durable background execution boundary for
agent events, tool-sandbox builds, sub-agent invocations, and live run streams.

Flow/state:
- `@outname/workflow` wraps `workflow`, `workflow/api`, and `workflow/next`.
- Starters call `start(...)`, persist `runId`, then readers use `getRun(runId)`.
- Step code reads metadata through `currentWorkflowRunId()`/`getWorkflowMetadata()`.
- Live UI uses `getWritable({ namespace })` to stream run, chat, and build chunks.
- `FatalError` means do not retry; `RetryableError` carries retry options.

Invariants:
- Feature code should import workflow runtime/API through `@outname/workflow/*`.
- `getWritable()` and workflow metadata access belong inside `"use step"` paths.
- Stream writes are best-effort breadcrumbs unless the caller explicitly fails.
- Run ids come from workflow metadata or `start(...)`; do not synthesize them.

Failure modes:
- `getRun` status reads return `not_found`/`null` or false when runs disappear.
- Workflow start failures bubble to the feature starter.
- Unknown step errors wrapped as fatal keep caller context in the message.

Anchors: `packages/workflow/*`, `apps/api/next.config.ts`,
`packages/ai/agent-runtime/server/agent-events.ts`,
`packages/ai/agent-runtime/server/workflow-runs.ts`,
`packages/ai/agent-runtime/server/run-events.ts`,
`packages/shared/server/workflow-step-errors.ts`.
