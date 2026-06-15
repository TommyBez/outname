# Tool Catalog

Scope/boundary:
- Agent-callable rows in `agent_tools`: `maintainer` or `sub_agent`; Skill `skill`/`bash` are never rows.
- Maintainer capabilities choose runtime: `sdk`, `brokered_http`, `repo_workspace`, `tool_sandbox`, or `none`.
- Brokered HTTP, repo workspace, and tool-sandbox runtimes are separate from system/Skill Sandbox.

Main flow:
- POST `/api/agents/[agentId]/tools/[toolId]` requires session and ownership.
- Maintainer attach parses config, encrypts allowed credential overrides, and upserts.
- `resolveToolPlan` filters removed tools, bad config, credentials, sandboxes, and invalid sub-agents.
- `buildAttachedTools` exposes tools/bundles and adds `build_failed` for throws or duplicate ids.
- Sub-agent tools dispatch child invocations; the child sees only the self-contained instruction.

State:
- `agent_tools` key is `(agentId, kind, toolId)`; sub-agents store `{ childAgentId }`.
- `status=pending` is sandbox build state; connected rows still need runtime validation.
- Runtime run id comes from realtime global, workflow metadata, or standalone fallback.
- Audit inserts `tool_invocations` with timing/status/error only; messages are clipped.

Invariants:
- Secrets stay out of model-visible config; runtime reads credentials through context.
- Credential overrides skip connection checks only for that connector.
- Sub-agents must be same owner, enabled, non-cyclic, and below max depth.

Failure modes:
- Reconnects: `tool_removed`, `config_invalid`, credential/scope gaps, sandbox building/unavailable, sub-agent unavailable/cycle/depth, `build_failed`.
- Brokered HTTP validates URL/headers/limits; repo workspaces evict/stop on provision or command failure.

Anchors: `packages/ai/tools/catalog/*`, `packages/ai/tools/runtime/*`, `packages/ai/tools/server/attachment-service/*`, `packages/ai/agent-runtime/workflows/session/steps/resolve-tool-plan.ts`, `apps/api/app/api/agents/[agentId]/tools/[toolId]/route.ts`.
