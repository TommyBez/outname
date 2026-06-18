# Maintainer Tool Authoring

Authoring rules:
- Add provider code under `packages/ai/tools/providers/*`, then register it in catalog order.
- Use `defineActionTool` for one runtime id; use `defineToolBundle` for child tools.
- Choose capabilities deliberately: `brokered_http`, `repo_workspace`, `sdk`, `tool_sandbox`, or `none`.
- Connector capabilities must reference a known connector; OAuth scopes must fit default scopes.
- Keep secrets out of `configSchema` and `inputSchema`; use `ctx.credentials` or `ctx.http`.
- Put attachment defaults in `configSchema`; put per-call decisions in `inputSchema`.
- Prefer `defineApiPassthroughTool` when provider calls should use brokered HTTP.
- Bind snapshot tools with `defineSandboxTool` or bundle `sandboxManifestId`.
- Return `toolSuccess`/`toolError`; thrown errors become provider errors and audit rows.
- Policies run before `execute` and can return `policy_denied`.

Attachment-sensitive rules:
- `attachMaintainerToolForUser` asserts owner, parses config, then upserts `agent_tools`.
- Credential overrides are allowed only for connector-backed capabilities and are encrypted.
- Tool-sandbox attachments call `ensureToolSandboxBuild`; building rows stay `pending`.
- Ready sandbox attachments are `connected` immediately and store manifest id/hash.
- `agent_tools` identity is `(agentId, kind, toolId)`.

Source anchors: `packages/ai/tools/catalog/registry.ts`, `packages/ai/tools/catalog/types.ts`, `packages/ai/tools/runtime/define-maintainer-tool/*`, `packages/ai/tools/server/attachment-service/maintainer.ts`.
Test anchors: `packages/ai/tools/catalog/registry.test.ts`, `packages/ai/tools/runtime/define-maintainer-tool/index.test.ts`, `packages/ai/tools/providers/github-repo.test.ts`.
