# Tool Sandboxes

Scope/boundary:
- Snapshot-backed runtimes for maintainer tools with `tool_sandbox` capability.
- Manifests are registry-only; hash includes stable descriptor and setup script bytes.
- Build/runtime sandboxes are non-persistent and distinct from system, Skill, brokered HTTP, and repo workspaces.

Main flow:
- Attach calls ensure; ready snapshot returns, active build coalesces by `(manifestId, manifestHash)`.
- New build writes `tool_sandbox_builds=pending`, starts workflow, then records `workflowRunId`.
- Workflow marks running, creates build sandbox, runs setup, snapshots, marks ready, emits events.
- Ready publishes `tool_sandbox_snapshots` and moves matching pending `agent_tools` to connected.

State:
- `tool_sandbox_snapshots` is global one row per manifest id; compatibility is manifest hash.
- Runtime `getOrStartToolSandbox` requires registered manifest and ready snapshot.
- Runtime sandboxes are snapshot resumes cached per `(runId, manifestId)`.
- Build stream state lives in workflow readable; DB stores coarse/terminal state.

Invariants:
- Do not use system or Skill Sandbox for tool setup/runtime.
- `agent_tools.status=pending` means waiting for snapshot, not callable runtime.
- Runtime commands slice stdout/stderr; optional timeout returns `timedOut`.

Failure modes:
- Unknown manifest, missing snapshot, or no active build reconnects as sandbox unavailable.
- Setup nonzero marks failed and stamps truncated error on pending attachments.
- Status/stream routes return 401/403/404 or 409; cleanup delete failures are logged/swallowed.

Anchors: `packages/ai/tools/sandboxes/*`, `packages/ai/tools/sandbox-runtime/runtime.ts`, `packages/ai/tools/runtime/tool-sandbox-runner.ts`, `apps/api/app/api/tool-sandbox-builds/[buildId]/*`, `packages/db/schema/tools.ts`.
