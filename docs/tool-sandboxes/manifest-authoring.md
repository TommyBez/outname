# Manifest Authoring

Sandbox taxonomy:
- System sandbox: persistent memory root, `deny-all`, system file tools only.
- Skill Sandbox: persistent `/skills` plus `/workspace`, `allow-all`, exposes `skill`/`bash`.
- Tool build sandbox: non-persistent manifest setup sandbox that produces a snapshot.
- Tool runtime sandbox: non-persistent resume from snapshot, cached per run and manifest.
- Brokered HTTP sandbox: per-run credential-injected fetch runner, not snapshot-backed.
- Repo workspace sandbox: per-run git clone runtime for maintainer tools, not a tool sandbox.

Manifest rules:
- Add `manifest.ts` and `setup.ts` under `packages/ai/tools/sandboxes/<id>/`.
- Register both in `packages/ai/tools/sandboxes/registry.ts`.
- `manifestHash` includes stable manifest fields and setup-script bytes.
- Changing either manifest or setup invalidates the ready snapshot at next attach.
- Builds coalesce by `(manifestId, manifestHash)` and reuse ready snapshots.
- The workflow marks running, creates a build sandbox, runs setup, snapshots, then marks ready.
- Ready builds upsert one `tool_sandbox_snapshots` row per manifest and connect pending tools.
- Failed setup stores truncated stderr/stdout and stamps waiting attachments with the error.
- Runtime requires a registered manifest and ready snapshot row; it never runs setup.
- Command output is sliced by caller limits; optional timeout returns `timedOut`.

Source anchors: `packages/ai/tools/sandboxes/*`, `packages/ai/tools/sandboxes/builds/*`, `packages/ai/tools/sandbox-runtime/runtime.ts`, `packages/ai/tools/runtime/tool-sandbox-runner.ts`.
Test anchors: `packages/ai/tools/sandboxes/builds/steps/sandbox-runtime.step.unit.test.ts`, `packages/ai/tools/sandboxes/builds/workflow.workflow.unit.test.ts`, `packages/ai/tools/sandbox-runtime/runtime.test.ts`.
