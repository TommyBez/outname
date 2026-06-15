# Realtime Runtime Spec

Implementation contract:
- `buildAgentRuntimeSpec` takes `agentId`, `eventKind`, optional `callStack`, `depth`, `nowIso`, and `runId`.
- It loads the agent row first; missing rows throw `buildAgentRuntimeSpec: agent ... not found`.
- Tool plan resolution reads `agentTools`, partitions maintainer/sub-agent rows, collects reconnects, and filters tools that require reconnect.
- Skill plan resolution reads `sandboxSkillsId`; sandbox discovery failures warn and return an empty skill list.
- Prompt composition reads the system sandbox, inlines eager bootstrap files, tracked files, reconnects, skill section, and platform invariants.
- Chat event prompts add a note that heartbeat/dreaming routines are inactive unless the user asks for them.
- The returned spec is JSON-serializable and carries provider/model, step limit, prompt, tool plan, skill plan, user id, and call stack.
- `buildRealtimeAgentRuntime` turns the spec into a `ToolLoopAgent` using `stopWhenFromSpec` and the user's provider-scoped model.

Source anchors: `packages/ai/agent-runtime/server/runtime-spec.ts`, `packages/ai/agent-runtime/workflows/session/runtime-spec-types.ts`, `packages/ai/agent-runtime/workflows/session/compose-system-prompt.ts`, `packages/ai/agent-runtime/workflows/session/steps/resolve-tool-plan.ts`, `packages/ai/agent-runtime/workflows/session/steps/resolve-skill-plan.ts`, `packages/ai/agent-runtime/server/realtime-agent-runtime.ts`.

Test anchors: `packages/ai/agent-runtime/server/runtime-spec.test.ts`.
