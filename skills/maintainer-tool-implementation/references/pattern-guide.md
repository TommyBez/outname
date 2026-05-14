# Maintainer Tool Pattern Guide

Use this file to pick the right helper before writing the tool.

## Quick Chooser

| Situation | Use | Capability | Best reference |
| --- | --- | --- | --- |
| Authenticated HTTP call with request/response normalization | `defineApiPassthroughTool` | `brokered_http` | `tools/providers/calcom.ts` |
| Custom execution flow with parsing, multiple steps, or mixed concerns | `defineActionTool` | `brokered_http`, `tool_sandbox`, `none`, or a mix | `tools/providers/resend.ts` |
| One attachment exposing several related child tools that share config and capabilities | `defineToolBundle` | `brokered_http`, `sdk`, `tool_sandbox`, or a mix | `tools/providers/v0.ts` |
| CLI or process executed inside a snapshot-backed sandbox | `defineSandboxTool` | `tool_sandbox` | `tools/providers/agent-browser.ts` |

## Authenticated Integrations: Required Security Pattern

If a tool is based on authenticated API (or CLI if applicable) the implementation must use Secret Injection pattern and restricted network policy as defined at [Vercel Sandbox credential injection](https://vercel.com/changelog/safely-inject-credentials-in-http-headers-with-vercel-sandbox).

Translate that into repo-level implementation rules:

- Credentials must stay outside the sandbox VM boundary
- Do not read secrets from tool config, per-call args, or command-line flags
- Do not construct `Authorization` or similar credential headers from raw secret values inside tool code
- Allow outbound traffic only to the minimum provider domains needed for the tool
- Prefer exact domains; use wildcards only when the provider genuinely requires them
- If sandboxed code or a CLI needs authenticated outbound HTTP, the auth material must be injected by the network policy layer rather than exposed to the process itself

For `brokered_http` tools in this repo, that means the provider/connector runtime should own authenticated egress. For `tool_sandbox` tools, the sandbox manifest and runtime policy must enforce the same rule.

## `defineActionTool`

Use when the tool does not fit a narrow passthrough shape.

Typical cases:

- multi-step provider flows
- custom response shaping
- input-dependent branching
- mixing policies with custom execution

Authenticated `defineActionTool` work must still follow the Secret Injection pattern. Use this helper for custom control flow, not for bypassing brokered auth or weakening egress policy.

Skeleton:

```ts
export const exampleTool = defineActionTool({
  id: 'provider_action',
  category: 'email',
  displayName: 'Provider · Action',
  description: 'Do one clear thing through the provider.',
  capabilities: [{ kind: 'brokered_http', provider: 'provider' }],
  configSchema,
  inputSchema,
  policies: [policy],
  async execute({ input, config, ctx }) {
    const response = await ctx.http.request('provider', {
      method: 'POST',
      url: 'https://api.example.com/action',
      headers: { 'content-type': 'application/json' },
      body: { ...input, defaultFromConfig: config.defaultValue },
    })

    if (!response.ok) {
      return toolError(
        'provider_error',
        `Provider rejected the request (HTTP ${response.status}).`
      )
    }

    return toolSuccess({ ok: true })
  },
})
```

## `defineApiPassthroughTool`

Use when the tool is fundamentally:

1. validate input
2. build one provider request
3. normalize one provider response

This helper is ideal when you want the repository to stay explicit about:

- input normalization
- request building
- response parsing
- safety policies

This is the default choice for authenticated provider APIs when one normalized request/response path is enough. Keep request building free of raw secret material; auth should be injected by the provider runtime outside the VM boundary.

Skeleton:

```ts
export const exampleTool = defineApiPassthroughTool({
  id: 'provider_request',
  category: 'scheduling',
  displayName: 'Provider · Request',
  description: 'Call a constrained provider API surface.',
  provider: 'provider',
  inputSchema,
  policies: [policy],
  toRequest({ input }) {
    return {
      method: input.method,
      url: `https://api.example.com${input.path}`,
      headers: { 'content-type': 'application/json' },
      body: input.body,
    }
  },
  handleResponse(response) {
    if (!response.ok) {
      return toolError(
        'provider_error',
        `Provider request failed (HTTP ${response.status}).`
      )
    }

    return toolSuccess({
      status: response.status,
      body: JSON.parse(response.bodyText),
    })
  },
})
```

## `defineSandboxTool`

Use when the tool must run inside a pre-built sandbox snapshot.

Typical cases:

- wrapping a CLI
- browser automation
- utilities that need local binaries or setup scripts
- workflows that benefit from state persisting inside the sandbox during a run

If the CLI talks to an authenticated service, the sandbox must use restricted egress plus Secret Injection. If that is not possible for the CLI, call it out as a blocker instead of passing secrets into env vars or args.

If the tool is part of a bundle, make sure the child tools actually inherit the bundle-level sandbox manifest at runtime and add a focused test for that path.

Repo convention for sandbox manifests:

- keep the descriptor in `tools/sandboxes/<id>/manifest.ts`
- keep the installer bytes in `tools/sandboxes/<id>/setup.ts` as a bundled string export
- register both the manifest and setup script through `tools/sandboxes/registry.ts`
- do not depend on runtime `readFileSync(process.cwd() + ...)` lookups for repo-relative `.sh` files inside deployed server code

Skeleton:

```ts
export const exampleTool = defineSandboxTool({
  id: 'sandbox_command',
  category: 'browser',
  displayName: 'sandbox-command',
  description: 'Run a sandbox-backed command and return stdout/stderr.',
  manifestId: 'sandbox-command',
  inputSchema,
  async execute({ input, ctx }) {
    const result = await ctx.sandbox.run({
      cmd: 'sandbox-command',
      args: input.args,
      timeoutMs: input.timeoutMs,
    })

    if (result.exitCode !== 0) {
      return toolError(
        'provider_error',
        `Command failed with exit code ${result.exitCode}.`
      )
    }

    return toolSuccess(result)
  },
})
```

## File Touch Guide

Always touch:

- `tools/providers/<tool-name>.ts`
- `tools/catalog/registry.ts`

Touch only when required:

- connector/provider code for a brand new `brokered_http` provider, usually under `connections/` plus `connections/registry.ts`
- `tools/sandboxes/<id>/manifest.ts`, `tools/sandboxes/<id>/setup.ts`, and `tools/sandboxes/registry.ts` for a brand new sandbox manifest
- sandbox network policy/auth injection setup when an authenticated CLI or runtime is introduced
- provider-agnostic runtime helpers when the repository does not yet have a reusable pattern for a new class of maintainer tool; do not hide those helpers under one provider-specific directory unless they are truly provider-specific
- `tools/catalog/types.ts` only if the new tool truly requires a new shared runtime concept
- runtime boot files like `tools/runtime/build-attached-tools.ts` or `agent-runtime/workflows/session/steps/resolve-tool-plan` only if the normal registry-driven flow is insufficient

## Naming Guidelines

- `id`: stable snake_case, database-safe, never marketing copy
- `displayName`: concise human-facing label, usually `Provider · Action`
- `description`: one paragraph the catalog UI and model can both use
- `category`: reuse an existing bucket when possible
