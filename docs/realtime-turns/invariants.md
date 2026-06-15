# Realtime Turns Invariants

Rules enforced in source:
- Ownership is checked before budget checks, sandbox startup, or runtime spec composition.
- Budget refusal skips sandbox startup, runtime build, usage recording, and title generation.
- `startupSystemSandbox` runs before `buildAgentRuntimeSpec`.
- Realtime runtime uses the provider-scoped user model and `stopWhenFromSpec`.
- UI assistant partials are persisted only when not aborted and not finished with `error`.
- Text-only delivery requires `postAgentStream`; if posting fails, partial accumulated text is not persisted.
- Cleanup runs in `finally` for both UI and text-only modes.

Source anchors: `packages/ai/agent-runtime/server/realtime-chat-runner.ts`, `packages/ai/agent-runtime/server/realtime-agent-runtime.ts`, `packages/ai/agent-runtime/server/runtime-spec.ts`, `packages/ai/agent-runtime/server/realtime-cleanup.ts`.
