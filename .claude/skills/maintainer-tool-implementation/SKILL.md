---
name: maintainer-tool-implementation
description: Implement a new maintainer tool in this codebase's tool catalog. Use when adding a tool under `tools/providers/`, wiring a connector-backed integration, wrapping an official SDK as AI tools or tool bundles, creating a `tool_sandbox` or `repo_workspace` tool, updating `tools/catalog/registry.ts`, or when the user mentions maintainer tools, connectors, OAuth scopes, `define-maintainer-tool`, `defineActionTool`, `defineToolBundle`, `defineApiPassthroughTool`, `defineSandboxTool`, brokered HTTP, SDK-backed tools, repo workspaces, or catalog tool attachments.
metadata:
  version: 1.3.0
---

# Maintainer Tool Implementation

Use this skill to ship a maintainer-owned tool that agents can attach from the catalog.

The current architecture is connector-based. A maintainer tool never asks for a "provider" credential directly. It declares a `connectorId` capability, and the runtime resolves that connector's credential, scopes, broker policy, sandbox policy, and setup state.

## Read First

Before making changes, read the local code that owns the relevant surface:

- `tools/catalog/types.ts` for `ToolCapability`, `Reconnect`, maintainer tool shape, and optional `displayDescription`
- `tools/catalog/client-description.ts` for catalog UI description fallback
- `shared/server/zod-config-fields.ts` for attachment-form field metadata and `[Group: …]` section parsing
- `tools/providers/rest-resource-groups.ts` when a passthrough or bundle tool spans multiple REST resource groups
- `tools/catalog/capabilities.ts` for connector-backed capability detection
- `tools/catalog/registry.ts` for registry wiring and boot validation
- `tools/runtime/define-maintainer-tool` for helper APIs and execution behavior
- `tools/runtime/define-maintainer-tool/credential-resolver.ts` when an SDK or runtime step needs connector credentials
- `tools/runtime/define-maintainer-tool/api-key-override.ts` when attachment-level API-key overrides matter
- `connections/types.ts`, `connections/registry.ts`, and one analogous connector under `connections/` when adding or changing connector-backed auth
- one analogous tool in `tools/providers/` that matches the new tool shape

Default references:

- `tools/providers/resend.ts` for a custom action tool using brokered HTTP with `connectorId: 'resend.api_key'`
- `tools/providers/calcom.ts` for an API passthrough tool with per-group config and request policies
- `tools/providers/vercel.ts` or `tools/providers/posthog.ts` for large declared REST resource registries with group access
- `tools/providers/x-api.ts` for separate app-only and OAuth user-context tools, per-group config, and `requiredScopes`
- `connections/x-oauth-scopes.ts` for an OAuth scope bundle shared by the connector and tool implementation
- `tools/providers/agent-browser.ts` for a sandbox-backed CLI tool
- `tools/providers/github-repo.ts` for a connector-backed live repository workspace bundle with `capabilities: [{ kind: 'repo_workspace', connectorId: 'github.personal_access_token' }]`
- `tools/providers/v0.ts` for a connector-backed SDK tool bundle with `capabilities: [{ kind: 'sdk', connectorId: 'v0.api_key' }]`
- `connections/oauth-token-client.ts` for shared OAuth token exchange and refresh protocol helpers
- `tools/runtime/define-maintainer-tool/provider-response.ts` for shared brokered HTTP response helpers
- `tools/runtime/define-maintainer-tool/sdk-step.ts` for connector-backed SDK credential reads inside workflow steps

Read `tools/runtime/build-attached-tools.ts` only if the new tool needs special runtime behavior. Most tools do not.

## Connector Vocabulary

Use these terms consistently:

- `connectorId`: the runtime auth surface, for example `x.bearer_token`, `x.oauth2_user`, `github.personal_access_token`, `v0.api_key`
- `providerGroup`: UI grouping only, for example `x`; do not use it for runtime auth
- `authKind`: connector auth mode, currently `api_key` or `oauth2`
- `surface`: product/API surface, such as `app_only` or `user_context`
- `requiredScopes`: tool-level OAuth scope requirement, valid only when the connector is OAuth-capable

Important invariants:

- A tool declares exactly the connector surface it needs; it does not choose among multiple auth methods at runtime.
- If a provider exposes meaningfully different API surfaces for app auth vs user-context OAuth, create separate tools or separate connector-backed capabilities.
- API-key credential overrides are allowed only for `authKind: 'api_key'` connectors.
- OAuth connectors do not support attachment credential overrides.
- `requiredScopes` must be a subset of the OAuth connector's `defaultScopes`; registry boot validation enforces this.
- If a tool and connector share an OAuth scope bundle, put the source of truth in a shared module and import it from both places, as `connections/x-oauth-scopes.ts` does for X.
- OAuth connector env var names should live on the connector so `validateConnectorRuntimeConfig` can return readable missing-env setup errors.
- Any OAuth connector requires Redis-backed refresh locking in non-test environments; `validateConnectorInfrastructureForEnv` enforces `KV_REST_API_URL` and `KV_REST_API_TOKEN`.

## Ask Only for Missing Details

If the request is underspecified, ask only for details that cannot be inferred from the repository:

- which provider/API surface the tool should use
- which existing or new `connectorId` should back it
- what actions are allowed and forbidden
- which OAuth scopes are required, if any
- whether the tool needs saved attachment config
- whether the action is destructive or irreversible

Do not ask for wiring details that the repository already makes clear.

## Goal

Deliver a tool that:

- has a stable registry id, clear catalog label, and optional short `displayDescription` for the attachment UI
- exposes a model-friendly input schema with useful field descriptions
- declares the correct capability: `brokered_http`, `sdk`, `tool_sandbox`, `repo_workspace`, or `none`
- keeps authenticated credentials outside tool code and outside the sandbox VM boundary
- uses `connectorId` and optional `requiredScopes` for connector-backed capabilities
- returns structured `toolSuccess(...)` / `toolError(...)` results
- is registered in `tools/catalog/registry.ts` so it becomes attachable automatically

## Core Rules

### 1. Put data in the right layer

Follow the three-layer rule from `tools/catalog/types.ts`:

- **Credentials**: connector-owned secret or OAuth token, never in tool config or per-call input
- **Attachment config**: saved defaults like sender address, workspace id, calendar id, repository URL, read-only mode
- **Per-call args**: the specific action the agent decides at invocation time

If a field is secret, it does not belong in `configSchema` or `inputSchema`.

For SDK-backed tools, choose one of two patterns:

- **Connector-backed SDK tools**: use `capabilities: [{ kind: 'sdk', connectorId: '<connectorId>' }]` and read credentials only at execute time from the connector runtime
- **Trusted-server-env SDK tools**: keep env lookup in trusted server code, use `capabilities: [{ kind: 'none' }]`, and never pass secrets through attachment config

### 2. Choose the narrowest helper

- Use `defineApiPassthroughTool` when the tool is mostly validated input -> authenticated HTTP request -> normalized response
- Use `defineActionTool` for custom multi-step logic or when you need to mix policies, brokered HTTP, parsing, SDK delegation, and custom result shaping
- Use `defineToolBundle` when one attachment should expose many AI SDK child tools directly
- Use `defineSandboxTool` when the tool runs a CLI or process inside a tool sandbox snapshot
- For repo-oriented sandbox tools, prefer the existing `bash-tool` adapter surface (`bash`, `readFile`, `writeFile`) before inventing provider-specific wrappers
- Prefer `tools/runtime/define-maintainer-tool/provider-response.ts` when several brokered HTTP tools need the same clipped-error / response-body plumbing
- Prefer `tools/runtime/define-maintainer-tool/sdk-step.ts` when a workflow step needs connector-backed SDK credentials without hand-rolling credential error mapping
- Prefer `tools/providers/rest-resource-groups.ts` when a REST passthrough or bundle spans multiple resource groups and needs shared enable/read-only config plus policy enforcement
- For sandbox manifests, keep installer bytes in `tools/sandboxes/<id>/setup.ts` and expose them through `tools/sandboxes/registry.ts`; do not rely on runtime reads of repo-relative `.sh` files

### 3. Enforce Secret Injection for authenticated tools

If a tool is based on an authenticated API or CLI, it must use the Secret Injection pattern and restricted network policy as defined at [Vercel Sandbox credential injection](https://vercel.com/changelog/safely-inject-credentials-in-http-headers-with-vercel-sandbox).

- Never pass raw credentials through `configSchema`, `inputSchema`, tool code, sandbox env, command args, child tool ids, or generated files
- For authenticated HTTP tools, rely on brokered/authenticated requests whose credentials are injected outside the VM boundary
- For authenticated CLI tools, use a sandbox/network policy that injects auth headers or tokens outside the VM boundary and only allows the minimum required outbound domains
- Restrict egress to exact provider domains or the narrowest wildcard needed
- If a provider or CLI cannot support this pattern cleanly, treat that as a blocker instead of shipping a weaker design

### 4. Respect connector auth kind

- For API-key connectors, attachment credential overrides may be supported by the existing override machinery.
- For OAuth connectors, never add credential override UI or server handling.
- For OAuth tools, declare `requiredScopes` when the endpoint needs a specific scope bundle.
- For app-only vs user-context APIs, use different connector ids and usually different tool ids, as `x_api_request` and `x_user_api_request` do.
- Do not tunnel user-context endpoints through an app-only connector just because the host is the same.

### 5. Make the schema model-friendly

Every important input and config field should have a `describe(...)` string. The model sees these descriptions and uses them to decide how to call the tool.

Split catalog copy when the model needs more detail than humans should see in the attachment picker:

- `description`: full, model-facing explanation of what the tool does and how to call it safely
- `displayDescription`: optional short label for catalog UI, child-tool rows, and agent creation flows
- set `displayDescription` on bundles and child tools when the technical `description` is long or noisy
- the UI resolves copy through `clientToolDescription(...)`, which prefers `displayDescription` and falls back to `description`

### 6. Guard destructive behavior

If the tool can create, cancel, delete, send, post, mutate, or otherwise do something irreversible, use concrete safety boundaries such as `readOnly` attachment config, narrow path allowlists, explicit deny policies, more specific tool surfaces, or human confirmation outside the tool input schema.

When a single attachment exposes API operations across multiple **resource groups** (for example projects, users, deployments, repositories, calendars, etc.), do not rely only on one global `readOnly` flag.

- Add **per-group enable flags** so users can disable an entire resource group.
- Add **per-group read-only flags** so users can allow reads but block writes for that specific group.
- Keep any existing global `readOnly` as a coarse safety override, but enforce group-level flags in each mutating child tool policy.
- Prefer clear field naming that maps to UX sections, such as `enableGroupProjects`, `readOnlyGroupProjects`.
- In the attachment form UX, organize complex configs by group sections so users can reason about one resource domain at a time.

For REST passthrough and bundle tools with multiple resource groups, reuse `tools/providers/rest-resource-groups.ts` instead of hand-rolling config field names or policy checks:

- declare a readonly `RestResourceDefinition[]` registry with `key`, `label`, and optional `defaultReadOnly`, `enableDescription`, and `readOnlyDescription`
- spread `...buildResourceConfigShape(resources)` into `configSchema`; this generates paired `enableGroup*` / `readOnlyGroup*` fields with stable suffixes from each resource `key`
- build group field descriptions with `withGroupPrefix(label, description)` so `describeConfigSchema` can parse `[Group: …]` into attachment-form sections
- use `groupToggleField` and `groupReadOnlyField` when adding one-off group booleans outside `buildResourceConfigShape`
- default to safe attachment behavior: group enable defaults to `true`, group read-only defaults to `true` unless a resource sets `defaultReadOnly: false`
- map each request path to exactly one declared resource; reject unknown paths with `policy_denied` before brokered HTTP runs
- validate and normalize paths first, then run resource lookup, then call `enforceResourceAccess({ config, globalReadOnly, method, resource })`
- treat `GET`, `HEAD`, and `OPTIONS` as safe methods that remain allowed when global or group read-only is enabled; block mutating methods otherwise
- when a group is disabled, block all methods for that group with a clear policy message

### 7. Keep failures crisp

- Use `toolError(...)` for expected failures
- Map provider failures to `provider_error`
- Prefer short, actionable messages
- Clip or summarize noisy provider errors instead of dumping huge payloads
- Investigate the actual tool's expected response shape and size before choosing `maxResponseBytes`
- For brokered HTTP tools, choose `connector.broker.maxResponseBytes` or request-level `maxResponseBytes` intentionally when provider payloads can exceed the broker default
- Do not return success for clipped payloads unless partial output is explicitly safe

## Implementation Workflow

Copy this checklist and work through it:

```md
Implementation checklist:
- [ ] Pick the tool pattern (`defineActionTool`, `defineApiPassthroughTool`, `defineToolBundle`, or `defineSandboxTool`)
- [ ] Decide whether the attachment exposes one tool or a bundle of child tools
- [ ] Decide capability needs (`brokered_http`, `sdk`, `tool_sandbox`, `repo_workspace`, or `none`)
- [ ] Identify the exact `connectorId`, if connector-backed
- [ ] For OAuth connectors, identify `requiredScopes` and confirm they are covered by the connector's `defaultScopes`
- [ ] Separate credentials vs attachment config vs per-call args
- [ ] If using an SDK, confirm whether auth comes from a connector-backed `sdk` capability or trusted server env `none`
- [ ] For authenticated tools, enforce Secret Injection and restricted network policy
- [ ] Investigate expected response size and truncation risk
- [ ] Decide whether brokered HTTP responses need connector-level or request-level `maxResponseBytes`
- [ ] Reuse shared brokered HTTP response helpers when response handling is mechanical
- [ ] Reuse the shared SDK step helper when connector-backed SDK credentials are needed inside a workflow step
- [ ] Add `displayDescription` when catalog UI needs shorter copy than the model-facing `description`
- [ ] For multi-group REST tools, declare a resource registry and reuse `rest-resource-groups.ts`
- [ ] Generate group config with `buildResourceConfigShape` and enforce access with `enforceResourceAccess`
- [ ] Reject undeclared paths and malformed paths before brokered HTTP
- [ ] Implement `tools/providers/<tool-name>.ts`
- [ ] Register the export in `tools/catalog/registry.ts`
- [ ] Update `TOOL_CATEGORY_ORDER` only if introducing a new category
- [ ] Add or reuse connector / sandbox manifest dependencies if required
- [ ] Run targeted verification
```

### Step 1: Scope the tool

Lock down:

- stable `id` in snake_case
- human-facing `displayName`
- model-facing `description`
- optional short `displayDescription` for catalog UI when the technical description is long
- category, preferably reusing an existing one
- whether the tool depends on a connector, sandbox snapshot, live repo workspace, SDK, or none
- if bundling, a stable attachment id plus stable namespaced child tool ids
- if OAuth-backed, required scope bundle and whether endpoints are read-only or mutating
- if REST passthrough spans multiple resource groups, the declared resource registry and which groups are mutating by default

### Step 2: Implement or reuse the connector

If the tool needs authentication, first check whether a matching connector already exists.

Use an existing connector when the auth method and API surface match exactly. Add a new connector only when the tool needs a genuinely different auth surface, such as app bearer vs OAuth user context.

Connector rules:

- Add connector definitions under `connections/`
- Register them in `connections/registry.ts`
- Use `connectorId` format `<providerGroup>.<suffix>`, matching the registry pattern
- Prefer auth-method suffixes for API-key connectors, such as `api_key`, `api_token`, or `personal_access_token`; use composite suffixes, such as `oauth2_user`, when one provider group exposes multiple OAuth surfaces
- Keep `providerGroup` as UI grouping only
- For `api_key`, define the form schema, fields, broker hosts, and injected headers
- For `oauth2`, define URLs, env var names, default scopes, scope catalog, broker hosts, injected headers, and profile metadata if needed
- Keep broker allowed hosts exact lowercase and injected header names lowercase

Do not add OAuth behavior to the maintainer tool itself. OAuth start/callback, refresh, PKCE, token storage, scopes, disconnect behavior, and token POST protocol details belong to the Connections layer and shared helpers such as `connections/oauth-token-client.ts`.

### Step 3: Implement the tool file

In `tools/providers/<tool-name>.ts`:

- define `configSchema` if the attachment needs saved defaults
- define `inputSchema`
- set `displayDescription` on the attachment and child tools when catalog UI should stay concise
- if the tool spans multiple REST resource groups, declare `RestResourceDefinition[]`, spread `buildResourceConfigShape(...)`, and enforce `enforceResourceAccess(...)` inside policies
- if bundling, define the child tool map and make child ids stable / namespaced
- if brokered HTTP is involved, investigate expected payload size and set `maxResponseBytes` deliberately
- implement execution with the chosen helper
- return compact structured data that is useful to the model

For `defineApiPassthroughTool`, pass `connectorId`, not `provider`.

For connector-backed manual capabilities, use:

```ts
capabilities: [{ kind: 'brokered_http', connectorId: 'example.api_key' }]
```

or:

```ts
capabilities: [
  {
    kind: 'brokered_http',
    connectorId: 'example.oauth2_user',
    requiredScopes: EXAMPLE_SCOPES,
  },
]
```

### Step 4: Register it

Add the new export to `tools/catalog/registry.ts` and include it in `TOOLS`.

Only add a new category ordering entry if the category is actually new.

Normal registry wiring automatically updates attachment planning, prompt setup issues, tool visibility, and capability summaries. Do not manually wire those surfaces unless the tool introduces a new runtime concept.

### Step 5: Wire dependencies only when needed

- New brokered HTTP tool on an existing connector: usually touch only `tools/providers/<tool>.ts`, `tools/catalog/registry.ts`, and tests
- New REST passthrough with multiple resource groups: reuse `tools/providers/rest-resource-groups.ts`, add or extend `tools/providers/rest-resource-groups.test.ts` and `tools/providers/passthrough-mutation-safety.test.ts` when policy behavior changes
- New connector-backed API surface: add or update `connections/` plus registry, then declare the exact `connectorId` on the tool
- New OAuth-backed tool: add `requiredScopes` when needed; do not implement OAuth flow inside the tool
- New SDK-backed tool with connector: ensure the connector exists, use `capabilities: [{ kind: 'sdk', connectorId: '<connectorId>' }]`, read credentials only at execute time, and never expose secrets through attachment config
- New SDK-backed tool with no connector: run the SDK entirely in trusted server code and use `capabilities: [{ kind: 'none' }]`
- New bundled tool: ensure one attachment row can expose multiple child tool ids cleanly
- New bundled sandbox tool: ensure child tools inherit the bundle-level sandbox manifest and add a focused test
- New sandbox tool: ensure the manifest exists in `tools/sandboxes/<id>/{manifest.ts, setup.ts}`, the manifest id matches exactly, and authenticated egress uses restricted network policy plus Secret Injection
- New live repo workspace tool: use `defineToolBundle` with `capabilities: [{ kind: 'repo_workspace', connectorId: '<connectorId>' }]`, do not add a sandbox manifest, do not use `ctx.sandbox.run`, read connector credentials only at execute time, sanitize Git remotes, and ensure cleanup goes through the repo-workspace runtime
- New runtime behavior: only then inspect `tools/runtime/build-attached-tools.ts`, `agent-runtime/workflows/session/steps/resolve-tool-plan`, or other runtime files

Do not edit `buildAttachedTools`, `agent-factory`, or `agents/server/capability-summary.ts` just to hook up a normal tool. Registry wiring is enough for standard tools.

### Step 6: Verify

At minimum:

- read the finished tool file and registry entry once
- confirm ids, category, connector ids, scope names, manifest names, and child tool ids are consistent
- confirm any authenticated flow uses Secret Injection and restricted network policy
- confirm OAuth `requiredScopes` are covered by the connector's `defaultScopes`
- confirm API-key overrides are allowed only for API-key connectors
- confirm connector-backed SDK tools read credentials only at execute time and never during tool build
- confirm the chosen `maxResponseBytes` matches the tool's expected payload shape and size
- confirm `response.truncated` is handled intentionally for brokered HTTP tools
- confirm REST resource-group tools reject undeclared paths and enforce global plus per-group read-only rules
- confirm group config fields use `[Group: …]` descriptions when the attachment form should render grouped toggles
- confirm `displayDescription` is present when the model-facing `description` is too long for catalog UI
- if you introduced a new runtime abstraction, confirm it is provider-agnostic and reusable by similar future tools
- run focused tests for resource-group policy and passthrough mutation safety when applicable
- run `pnpm check` if the change is substantial or touches shared runtime types
- mention any unimplemented prerequisite such as a missing connector, missing sandbox manifest, missing OAuth app config, or missing product rule

## Default Reference Patterns

For quicker pattern selection and code skeletons, see [references/pattern-guide.md](references/pattern-guide.md).

For final checks before closing the task, see [references/validation-checklist.md](references/validation-checklist.md).

## Output Expectations

When you finish, report:

- which pattern you chose and why
- which connector id or auth surface the tool uses, if any
- whether you added `displayDescription` and how catalog copy differs from model copy
- whether the tool uses a declared REST resource registry and per-group access controls
- which files changed
- whether the attachment exposes one tool or a bundle of child tools
- whether the tool is ready immediately or still depends on connector config, OAuth app config, sandbox build, or product decision
- what verification you ran
