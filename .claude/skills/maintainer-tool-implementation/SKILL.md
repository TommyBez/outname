---
name: maintainer-tool-implementation
description: Implement a new maintainer tool in this codebase's tool catalog. Use when adding a tool under `tools/`, wiring a provider-backed integration, creating a `tool_sandbox` tool, updating `tools/registry.ts`, or when the user mentions maintainer tools, `define-maintainer-tool`, `defineActionTool`, `defineApiPassthroughTool`, `defineSandboxTool`, brokered HTTP, or catalog tool attachments.
metadata:
  version: 1.1.3
---

# Maintainer Tool Implementation

Use this skill to ship a new maintainer-owned tool that agents can attach from the catalog.

## Read First

Before making changes, read:

- `tools/define-maintainer-tool.ts`
- `tools/types.ts`
- `tools/registry.ts`
- one analogous tool file in `tools/` that matches the new tool shape

Default references:

- `tools/resend.ts` for a custom action tool using brokered HTTP
- `tools/calcom.ts` for an API passthrough tool with policies
- `tools/agent-browser.ts` for a sandbox-backed CLI tool

Read `tools/build-attached-tools.ts` only if the new tool needs special runtime behavior. Most tools do not.

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
- uses the correct capability surface: `brokered_http`, `tool_sandbox`, or `none`
- keeps authenticated credentials outside tool code and the sandbox VM boundary
- returns structured `toolSuccess(...)` / `toolError(...)` results
- is registered in `tools/registry.ts` so it becomes attachable automatically

## Core Rules

### 1. Put data in the right layer

Follow the three-layer rule from `tools/types.ts`:

- **Credentials**: provider secret/API key lives in the connector runtime, never in tool config or tool code
- **Attachment config**: saved defaults like sender address, workspace id, calendar id
- **Per-call args**: what the agent decides at invocation time

If a field is secret, it does not belong in `configSchema`.

### 2. Choose the narrowest helper

- Use `defineActionTool` for custom multi-step logic or when you need to mix policies, brokered HTTP, parsing, and custom result shaping
- Use `defineApiPassthroughTool` when the tool is mostly "validated input -> authenticated HTTP request -> normalized response"
- Use `defineSandboxTool` when the tool runs a CLI or process inside a tool sandbox snapshot
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
- [ ] Decide capability needs (`brokered_http`, `tool_sandbox`, or `none`)
- [ ] Separate credentials vs attachment config vs per-call args
- [ ] For authenticated tools, enforce Secret Injection pattern and restricted network policy
- [ ] Investigate the expected response size and truncation risk for the actual tool
- [ ] Decide whether brokered HTTP responses need a connector-level or request-level `maxResponseBytes` override
- [ ] Implement `tools/<tool-name>.ts`
- [ ] Register the export in `tools/registry.ts`
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

### Step 2: Implement the tool file

In `tools/<tool-name>.ts`:

- define `configSchema` if the attachment needs saved defaults
- define `inputSchema`
- if brokered HTTP is involved, investigate the expected payload size for this tool and then size `maxResponseBytes` deliberately instead of relying on the small broker default
- implement execution with the chosen helper
- return compact structured data that is useful to the model

### Step 3: Register it

Add the new export to `tools/registry.ts` and include it in `TOOLS`.

Only add a new category ordering entry if the category is actually new.

### Step 4: Wire dependencies only when needed

- New provider-backed tool: ensure the connector/provider exists, the capability provider name matches it exactly, and authenticated requests use Secret Injection rather than in-tool secret handling
- New sandbox tool: ensure the manifest exists in `tools/sandboxes/<id>/{manifest.ts, setup.ts}`, the manifest id matches exactly, the registry exposes bundled setup-script bytes, and any authenticated egress uses a restricted network policy plus Secret Injection
- New runtime behavior: only then inspect `tools/build-attached-tools.ts`, `resolve-tool-plan`, or other runtime files

Do not edit `buildAttachedTools`, `agent-factory`, or `lib/agent-capability-summary.ts` just to "hook up" a normal tool. Registry wiring is enough for standard tools.

### Step 5: Verify

At minimum:

- read the finished tool file and registry entry once
- confirm ids, category, provider, and manifest names are consistent
- confirm any authenticated flow uses Secret Injection and a restricted network policy
- confirm the chosen `maxResponseBytes` matches the tool's expected payload shape and size
- confirm `response.truncated` is handled intentionally for brokered HTTP tools
- run `pnpm check` if the change is substantial or touches shared runtime types
- mention any unimplemented prerequisite such as a missing connector, missing sandbox manifest, or missing product rule instead of guessing

## Default Reference Patterns

For quicker pattern selection and code skeletons, see [references/pattern-guide.md](references/pattern-guide.md).

For final checks before closing the task, see [references/validation-checklist.md](references/validation-checklist.md).

## Output Expectations

When you finish, report:

- which pattern you chose and why
- which files changed
- whether the tool is ready immediately or still depends on a connector, sandbox, or product decision
- what verification you ran
