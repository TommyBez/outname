# Reconnect And Audit

Planning:
- `resolveToolPlan` reads `agent_tools`, partitions maintainer and sub-agent rows, then resolves each kind.
- Removed catalog ids become `tool_removed`; invalid stored config becomes `config_invalid`.
- Tool-sandbox requirements reconnect as `tool_sandbox_building` or `tool_sandbox_unavailable`.
- Stored credential overrides skip connection checks only for that connector.
- Connector availability adds `connection_unavailable` or `missing_scopes` and removes that planned tool.
- Sub-agent reconnects cover unavailable child, cycle, and max-depth failures.

Build/runtime:
- `buildAttachedTools` reuses planning reconnects and adds `build_failed`.
- Provider build throws and duplicate exposed runtime ids both become `build_failed`.
- The runtime run id comes from realtime global, workflow metadata, or standalone fallback.
- `createRuntimeContext` injects credentials, brokered HTTP, sandbox runner, and audit.

Audit:
- `executeWithPolicies` records in `finally`, so policy, provider, and thrown errors are audited.
- Rows go to `tool_invocations` with agent/user/run/conversation/tool/kind/timing/status.
- Error messages are clipped to 4000 chars; message bodies and secret config are not stored.
- Audit insert failure is logged and swallowed so it does not change the tool result.

Source anchors: `packages/ai/agent-runtime/workflows/session/steps/resolve-tool-plan.ts`, `packages/ai/tools/runtime/build-attached-tools.ts`, `packages/ai/tools/runtime/run-id.ts`, `packages/ai/tools/runtime/audit.ts`.
Test anchors: `packages/shared/connections/runtime/availability.test.ts`, `packages/ai/tools/providers/resend.test.ts`, `packages/ai/tools/providers/passthrough-mutation-safety.test.ts`.
