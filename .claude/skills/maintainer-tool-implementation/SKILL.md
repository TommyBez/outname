---
name: maintainer-tool-implementation
description: Implement a new maintainer tool in this codebase's tool catalog. Use when adding a tool under `tools/providers/`, wiring a provider-backed integration, wrapping an official SDK as AI tools or tool bundles, creating a `tool_sandbox` tool, updating `tools/catalog/registry.ts`, or when the user mentions maintainer tools, `define-maintainer-tool`, `defineActionTool`, `defineToolBundle`, `defineApiPassthroughTool`, `defineSandboxTool`, brokered HTTP, SDK-backed tools, or catalog tool attachments.
metadata:
  version: 1.1.7
---

# Maintainer Tool Implementation

Use this skill to ship a new maintainer-owned tool that agents can attach from the catalog.

## Read First

Before making changes, read:

- `tools/runtime/define-maintainer-tool`
- `tools/catalog/types.ts`
- `tools/catalog/registry.ts`
- one analogous tool file in `tools/providers/` that matches the new tool shape

Default references:

- `tools/providers/resend.ts` for a custom action tool using brokered HTTP
- `tools/providers/calcom.ts` for an API passthrough tool with policies
- `tools/providers/agent-browser.ts` for a sandbox-backed CLI tool
- `tools/providers/v0.ts` for a connector-backed SDK tool bundle with `capabilities: [{ kind: 'sdk', provider: 'v0' }]`
- `tools/runtime/define-maintainer-tool/provider-response.ts` for shared brokered HTTP response helpers
- `tools/runtime/define-maintainer-tool/sdk-step.ts` for connector-backed SDK credential reads inside workflow steps

Read `tools/runtime/build-attached-tools.ts` only if the new tool needs special runtime behavior. Most tools do not.

## Ask Only for Missing Details

If the request is underspecified, ask only for the pieces that are genuinely missing:

- which provider or runtime the tool talks to
- what actions are allowed and forbidden
- whether the tool needs saved attachment config
- whether the action is destructive or irreversible

Do not ask for wiring details that the repository already makes clear.

## Goal

Deliver a tool that:

- has a stable registry id and clear catalog label
- exposes a model-friendly input schema with useful field descriptions
- uses the correct capability surface: `brokered_http`, `sdk`, `tool_sandbox`, or `none`
- keeps authenticated credentials outside tool code and the sandbox VM boundary
- returns structured `toolSuccess(...)` / `toolError(...)` results
- is registered in `tools/catalog/registry.ts` so it becomes attachable automatically

## Core Rules

### 1. Put data in the right layer

Follow the three-layer rule from `tools/catalog/types.ts`:

- **Credentials**: provider secret/API key usually lives in the connector runtime, never in tool config or tool code
- **Attachment config**: saved defaults like sender address, workspace id, calendar id
- **Per-call args**: what the agent decides at invocation time

If a field is secret, it does not belong in `configSchema`. For SDK-backed tools, choose one of two patterns:

- **Connector-backed SDK tools**: use `capabilities: [{ kind: 'sdk', provider: '<connector>' }]` and read credentials only at execute time from the connector runtime
- **Trusted-server-env SDK tools**: keep the env lookup in server code and document that the tool uses `capabilities: [{ kind: 'none' }]`

### 2. Choose the narrowest helper

- Use `defineActionTool` for custom multi-step logic or when you need to mix policies, brokered HTTP, parsing, SDK delegation, and custom result shaping
- Use `defineToolBundle` when one attachment should expose many AI SDK child tools directly (for example, flattening an SDK-provided tool map into namespaced child tool ids)
- Use `defineApiPassthroughTool` when the tool is mostly "validated input -> authenticated HTTP request -> normalized response"
- Use `defineSandboxTool` when the tool runs a CLI or process inside a tool sandbox snapshot
- When a tool combines provider APIs, sandbox lifecycle, and repository/file operations, keep `tools/providers/<tool>.ts` declarative and move reusable mechanics into provider-agnostic runtime helpers instead of tool-specific helper files
- Prefer `tools/runtime/define-maintainer-tool/provider-response.ts` when several brokered HTTP tools need the same clipped-error / response-body plumbing
- Prefer `tools/runtime/define-maintainer-tool/sdk-step.ts` when a workflow step needs connector-backed SDK credentials without hand-rolling `readBrokeredCredential` error mapping
- For sandbox manifests in this repo, keep installer bytes in `tools/sandboxes/<id>/setup.ts` and expose them through `tools/sandboxes/registry.ts`; do not rely on runtime reads of repo-relative `.sh` files

### 3. Enforce Secret Injection for authenticated tools

If a tool is based on authenticated API (or CLI if applicable) the implementation must use Secret Injection pattern and restricted network policy as defined at [Vercel Sandbox credential injection](https://vercel.com/changelog/safely-inject-credentials-in-http-headers-with-vercel-sandbox).

- Never pass raw credentials through `configSchema`, `inputSchema`, tool code, or sandbox process args
- For authenticated HTTP tools, rely on brokered/authenticated requests whose credentials are injected outside the VM boundary
- For authenticated CLI tools, use a sandbox/network policy that injects auth headers or tokens outside the VM boundary and only allows the minimum required outbound domains
- Restrict egress to exact provider domains or the narrowest wildcard needed; do not default to broad `allow-all` for authenticated destinations
- If a provider or CLI cannot support this pattern cleanly, treat that as a blocker and report it instead of shipping a weaker design

### 4. Make the schema model-friendly

Every important input and config field should have a `describe(...)` string. The model sees these descriptions and uses them to decide how to call the tool.

### 5. Guard destructive behavior

If the tool can create, cancel, delete, send, mutate, or otherwise do something irreversible, add an explicit safety policy or confirmation flag instead of trusting the model to be cautious.

### 6. Keep failures crisp

- Use `toolError(...)` for expected failures
- Map provider failures to `provider_error`
- Prefer short, actionable messages
- Clip or summarize noisy provider errors instead of dumping huge payloads
- Investigate the actual tool's expected response shape and size before choosing `maxResponseBytes`. Use provider docs, analogous tools, and payload controls such as formats, result counts, or excerpt limits instead of guessing
- For brokered HTTP tools, choose `connector.broker.maxResponseBytes` or `request.maxResponseBytes` intentionally when provider payloads can exceed the broker default
- Do not return success for clipped payloads unless partial output is explicitly safe. If `response.truncated` would make JSON, markdown, or HTML incomplete, raise the cap and still return `toolError(...)` when truncation happens

## Implementation Workflow

Copy this checklist and work through it:

```md
Implementation checklist:
- [ ] Pick the tool pattern (`defineActionTool`, `defineApiPassthroughTool`, or `defineSandboxTool`)
- [ ] Decide whether the attachment should expose one tool or a bundle of child tools
- [ ] Decide capability needs (`brokered_http`, `sdk`, `tool_sandbox`, or `none`)
- [ ] Separate credentials vs attachment config vs per-call args
- [ ] If using an SDK instead of direct HTTP, confirm whether auth comes from a connector-backed `sdk` capability or trusted server env `none`
- [ ] For authenticated tools, enforce Secret Injection pattern and restricted network policy
- [ ] Investigate the expected response size and truncation risk for the actual tool
- [ ] Decide whether brokered HTTP responses need a connector-level or request-level `maxResponseBytes` override
- [ ] Reuse the shared brokered HTTP response helpers when the response handling is mechanical rather than provider-specific
- [ ] Reuse the shared SDK step helper when a connector-backed SDK tool needs credentials inside a workflow step
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
- short catalog `description`
- category, preferably reusing an existing one
- whether the tool depends on a provider connection, sandbox snapshot, or neither
- if bundling, a stable attachment id plus stable namespaced child tool ids

### Step 2: Implement the tool file

In `tools/providers/<tool-name>.ts`:

- define `configSchema` if the attachment needs saved defaults
- define `inputSchema`
- if bundling, define the child tool map and make child ids stable / namespaced
- if brokered HTTP is involved, investigate the expected payload size for this tool and then size `maxResponseBytes` deliberately instead of relying on the small broker default
- implement execution with the chosen helper
- return compact structured data that is useful to the model

### Step 3: Register it

Add the new export to `tools/catalog/registry.ts` and include it in `TOOLS`.

Only add a new category ordering entry if the category is actually new.

### Step 4: Wire dependencies only when needed

- New provider-backed tool: ensure the connector/provider exists in `connections/registry.ts`, the capability provider name matches it exactly, and authenticated requests use Secret Injection rather than in-tool secret handling
- New SDK-backed tool with connector: ensure the connector/provider exists in `connections/registry.ts`, the tool uses `capabilities: [{ kind: 'sdk', provider: '<name>' }]`, credentials are read only at execute time from the connector runtime, and secrets never flow through attachment config or child tool ids
- New SDK-backed tool with no connector: ensure the SDK runs entirely in trusted server code, uses `capabilities: [{ kind: 'none' }]`, and does not push secrets into attachment config or sandbox args
- New bundled tool: ensure one attachment row can expose multiple child tool ids cleanly, and keep child ids namespaced to avoid collisions in the runtime tool dictionary
- New bundled sandbox tool: ensure bundle child tools inherit the bundle-level sandbox manifest cleanly and add a focused test for that runtime path
- New sandbox tool: ensure the manifest exists in `tools/sandboxes/<id>/{manifest.ts, setup.ts}`, the manifest id matches exactly, the registry exposes bundled setup-script bytes, and any authenticated egress uses a restricted network policy plus Secret Injection
- New runtime behavior: only then inspect `tools/runtime/build-attached-tools.ts`, `agent-runtime/workflows/session/steps/resolve-tool-plan`, or other runtime files

Do not edit `buildAttachedTools`, `agent-factory`, or `agents/server/capability-summary.ts` just to "hook up" a normal tool. Registry wiring is enough for standard tools.

### Step 5: Verify

At minimum:

- read the finished tool file and registry entry once
- confirm ids, category, provider, manifest names, and any child tool ids are consistent
- confirm any authenticated flow uses Secret Injection and a restricted network policy
- confirm connector-backed SDK tools read credentials only at execute time and never during tool build
- confirm the chosen `maxResponseBytes` matches the tool's expected payload shape and size
- confirm `response.truncated` is handled intentionally for brokered HTTP tools
- if you introduced a new runtime abstraction, confirm it is provider-agnostic and reusable by similar future tools rather than nested under one provider-specific implementation path
- run `pnpm check` if the change is substantial or touches shared runtime types
- mention any unimplemented prerequisite such as a missing connector, missing sandbox manifest, or missing product rule instead of guessing

## Default Reference Patterns

For quicker pattern selection and code skeletons, see [references/pattern-guide.md](references/pattern-guide.md).

For final checks before closing the task, see [references/validation-checklist.md](references/validation-checklist.md).

## Output Expectations

When you finish, report:

- which pattern you chose and why
- which files changed
- whether the attachment exposes one tool or a bundle of child tools
- whether the tool is ready immediately or still depends on a connector, sandbox, or product decision
- what verification you ran
