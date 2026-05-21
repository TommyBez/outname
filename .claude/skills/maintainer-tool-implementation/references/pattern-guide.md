# Maintainer Tool Pattern Guide

Use this file to pick the right helper before writing the tool.

## Quick Chooser

| Situation | Use | Capability | Best reference |
| --- | --- | --- | --- |
| Authenticated HTTP call with request/response normalization | `defineApiPassthroughTool` | `brokered_http` with `connectorId` | `tools/providers/calcom.ts`, `tools/providers/x-api.ts` |
| Custom execution flow with parsing, multiple steps, or mixed concerns | `defineActionTool` | `brokered_http`, `tool_sandbox`, `none`, or a mix | `tools/providers/resend.ts` |
| One attachment exposing several related child tools that share config and capabilities | `defineToolBundle` | `brokered_http`, `sdk`, `tool_sandbox`, or a mix | `tools/providers/v0.ts` |
| Repo cloned live per run, connector-backed credentials, no snapshot | `defineToolBundle` | `repo_workspace` with `connectorId` | `tools/providers/github-repo.ts` |
| CLI or process executed inside a snapshot-backed sandbox | `defineSandboxTool` | `tool_sandbox` | `tools/providers/agent-browser.ts` |
| Trusted server-only behavior without user credentials | `defineActionTool` or `defineToolBundle` | `none` | inspect analogous trusted-server tools |

## Connector-Backed Capabilities

Connector-backed tool capabilities use `connectorId`, never `provider`.

Current connector-backed capability shapes:

```ts
{ kind: 'brokered_http', connectorId: 'x.bearer_token' }
{ kind: 'brokered_http', connectorId: 'x.oauth2_user', requiredScopes: X_OAUTH_SCOPES }
{ kind: 'sdk', connectorId: 'v0.api_key' }
{ kind: 'repo_workspace', connectorId: 'github.personal_access_token' }
```

Use `requiredScopes` only for OAuth-backed connector surfaces. Scope names must be covered by the connector's `oauth2.defaultScopes`; registry validation should fail fast if they drift.

Do not use `providerGroup` in tool capabilities. `providerGroup` exists for grouping connectors in UI only.

## Authenticated Integrations: Required Security Pattern

If a tool is based on an authenticated API or CLI, the implementation must use Secret Injection and restricted network policy as defined at [Vercel Sandbox credential injection](https://vercel.com/changelog/safely-inject-credentials-in-http-headers-with-vercel-sandbox).

Repo-level rules:

- Credentials must stay outside the sandbox VM boundary
- Do not read secrets from tool config, per-call args, command-line flags, or child tool ids
- Do not construct `Authorization` or similar credential headers from raw secret values inside sandboxed code
- Allow outbound traffic only to the minimum provider domains needed for the tool
- Prefer exact domains; use wildcards only when the provider genuinely requires them
- If sandboxed code or a CLI needs authenticated outbound HTTP, auth material must be injected by the network policy layer rather than exposed to the process itself

For `brokered_http` tools, the connector broker owns authenticated egress and injected headers. For `repo_workspace` tools, the repo-workspace runtime creates the sandbox and network policy at execute time. For `tool_sandbox` tools, the sandbox manifest and runtime policy must enforce the same rule.

## API-Key vs OAuth Connector Surfaces

API-key and OAuth connectors are separate runtime surfaces.

- API-key connectors may support attachment credential overrides through the existing override machinery.
- OAuth connectors never support credential overrides.
- OAuth scopes live in the connector definition and optional tool `requiredScopes`.
- If the API surface differs by auth mode, create or use separate tool ids.
- If the connector and tool need the same OAuth scope bundle, keep it in one shared module. X uses `connections/x-oauth-scopes.ts`, imported by both `connections/x.ts` and `tools/providers/x-api.ts`.
- OAuth token exchange and refresh protocol code belongs in `connections/oauth-token-client.ts`; maintainer tools should not implement token POSTs directly.

Example from X:

- `x.bearer_token` backs `x_api_request` for app-only requests
- `x.oauth2_user` backs `x_user_api_request` for user-context requests and declares `requiredScopes`

Do not add a tool that silently accepts either connector. One maintainer tool capability should point at one explicit connector surface.

## `defineActionTool`

Use when the tool does not fit a narrow passthrough shape.

Typical cases:

- multi-step provider flows
- custom response shaping
- input-dependent branching
- mixing policies with custom execution
- trusted server-side SDK or service calls that do not need a user connector

Authenticated `defineActionTool` work must still follow Secret Injection. Use this helper for custom control flow, not for bypassing brokered auth or weakening egress policy.

Skeleton:

```ts
export const exampleTool = defineActionTool({
  id: 'example_action',
  category: 'email',
  displayName: 'Example · Action',
  description: 'Do one clear thing through Example.',
  capabilities: [{ kind: 'brokered_http', connectorId: 'example.api_key' }],
  configSchema,
  inputSchema,
  policies: [policy],
  async execute({ input, config, ctx }) {
    const response = await ctx.http.request('example.api_key', {
      method: 'POST',
      url: 'https://api.example.com/action',
      headers: { 'content-type': 'application/json' },
      body: { ...input, defaultFromConfig: config.defaultValue },
    })

    if (!response.ok) {
      return toolError(
        'provider_error',
        `Example rejected the request (HTTP ${response.status}).`
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

This helper is ideal when you want explicit request building, safety policies, and provider response normalization.

Keep request building free of raw secret material; auth is injected by the connector broker outside the VM boundary.

Skeleton:

```ts
export const exampleTool = defineApiPassthroughTool({
  id: 'example_request',
  category: 'scheduling',
  displayName: 'Example · Request',
  description: 'Call a constrained Example API surface.',
  connectorId: 'example.api_key',
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
        `Example request failed (HTTP ${response.status}).`
      )
    }

    return toolSuccess({
      status: response.status,
      body: JSON.parse(response.bodyText),
    })
  },
})
```

OAuth variant:

```ts
export const exampleUserTool = defineApiPassthroughTool({
  id: 'example_user_request',
  category: 'social',
  displayName: 'Example · OAuth User Request',
  description: 'Call constrained user-context Example endpoints.',
  connectorId: 'example.oauth2_user',
  requiredScopes: EXAMPLE_OAUTH_SCOPES,
  inputSchema,
  policies: [policy],
  toRequest,
  handleResponse,
})
```

## `defineToolBundle`

Use when one attachment exposes multiple related child tools sharing the same config and capabilities.

Rules:

- Keep child tool ids stable and namespaced.
- Put shared connection requirements on the bundle-level `capabilities`.
- If child tools are conditionally enabled, implement `isEnabled(config)` and verify `resolveExposedTools`.
- If the bundle is sandbox-backed, set the bundle-level `sandboxManifestId` and verify children inherit it at runtime.

Connector-backed SDK skeleton:

```ts
export const exampleSdkTool = defineToolBundle({
  id: 'example_platform',
  category: 'developer',
  displayName: 'Example Platform',
  description: 'Use Example SDK tools.',
  capabilities: [{ kind: 'sdk', connectorId: 'example.api_key' }],
  configSchema,
  tools: {
    example_child: {
      displayName: 'Example · Child',
      description: 'Run one SDK-backed operation.',
      inputSchema,
      async execute({ input, ctx }) {
        return await runExampleSdkStep({
          input,
          userId: ctx.userId,
          connectorId: 'example.api_key',
        })
      },
    },
  },
})
```

Read credentials only inside trusted execute-time server/workflow code, usually via `tools/runtime/define-maintainer-tool/sdk-step.ts` or `credential-resolver.ts`. Do not read credentials during `build()`.

## Live Repo Workspace

Use `capabilities: [{ kind: 'repo_workspace', connectorId: '<connectorId>' }]` when a tool clones a repository live for a run with connector-backed credentials and no prebuilt snapshot.

This pattern is exclusive with snapshot-backed sandbox tools:

- It uses `defineToolBundle`, usually exposing `bash`, `readFile`, and `writeFile` child tools.
- It does not take a sandbox `manifest`.
- It does not use `ctx.sandbox.run`.
- It does not use prebuilt snapshots or files under `tools/sandboxes/<id>`.
- It reads connector credentials only at execute time to create the sandbox and network policy.
- GitHub HTTPS auth is brokered by the sandbox network policy for git and HTTPS API requests; the sandbox should not receive env tokens, passwords, or credentialized remote URLs.
- Git remotes must be sanitized before exposing bash so connector tokens are not readable from `.git/config`.
- Agents should use repo workspace child tools for repository files; generic system-sandbox file tools write to a different filesystem.
- Run/event cleanup must go through `tools/runtime/repo-workspace`.

## `defineSandboxTool`

Use when the tool must run inside a pre-built sandbox snapshot.

Typical cases:

- wrapping a CLI
- browser automation
- utilities that need local binaries or setup scripts
- workflows that benefit from state persisting inside the sandbox during a run

If the CLI talks to an authenticated service, the sandbox must use restricted egress plus Secret Injection. If that is not possible for the CLI, call it out as a blocker instead of passing secrets into env vars or args.

If the tool is part of a bundle, make sure the child tools inherit the bundle-level sandbox manifest at runtime and add a focused test for that path.

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

- `connections/` and `connections/registry.ts` for a brand new connector or changed auth surface
- shared OAuth scope source modules when both a connector and tool need the same scope bundle
- live repo workspace network policy and cleanup wiring for a new repo-workspace runtime surface
- `tools/sandboxes/<id>/manifest.ts`, `tools/sandboxes/<id>/setup.ts`, and `tools/sandboxes/registry.ts` for a new sandbox manifest
- sandbox network policy/auth injection setup when authenticated CLI or sandboxed runtime egress is introduced
- provider-agnostic runtime helpers when the repository lacks a reusable pattern for a new class of maintainer tool
- `tools/catalog/types.ts` only if the new tool truly requires a new shared runtime concept
- runtime boot files like `tools/runtime/build-attached-tools.ts` or `agent-runtime/workflows/session/steps/resolve-tool-plan` only if normal registry-driven flow is insufficient

Do not touch:

- OAuth start/callback/refresh routes for a normal OAuth-backed tool
- `agent-factory` or capability summary files for normal registry wiring
- database schema for ordinary tool additions

## Naming Guidelines

- `id`: stable snake_case, database-safe, never marketing copy
- `displayName`: concise human-facing label, usually `Provider · Action`
- `description`: one paragraph the catalog UI and model can both use
- `connectorId`: exact connector runtime surface, never a provider group
- `category`: reuse an existing bucket when possible
