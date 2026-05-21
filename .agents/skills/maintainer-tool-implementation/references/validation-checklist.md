# Maintainer Tool Validation Checklist

Use this checklist before closing a maintainer-tool task.

## Shape

- [ ] `id` is unique, stable, and snake_case
- [ ] `displayName` is clear in the catalog UI
- [ ] `description` explains the tool's purpose without leaking implementation noise
- [ ] category reuses an existing bucket unless a new one is truly needed
- [ ] `configSchema` only contains attachment defaults
- [ ] `inputSchema` only contains per-call arguments
- [ ] important fields use `describe(...)`
- [ ] returned data is compact, structured, and useful to the model
- [ ] bundled child tool ids are stable and namespaced

## Connector And Auth

- [ ] connector-backed capabilities use `connectorId`, not `provider`
- [ ] `connectorId` exactly matches an entry in `connections/registry.ts`
- [ ] tool capability uses the correct connector surface, for example app-only vs OAuth user-context
- [ ] no raw credentials, tokens, refresh tokens, client secrets, or API keys were added to tool config or inputs
- [ ] API-key credential overrides are only possible for `authKind: 'api_key'` connectors
- [ ] OAuth connectors do not expose credential overrides
- [ ] OAuth tools declare `requiredScopes` when endpoint access depends on scopes
- [ ] `requiredScopes` are a subset of the connector's `oauth2.defaultScopes`
- [ ] shared OAuth scope bundles are imported from one source of truth when used by both connector and tool
- [ ] connector broker hosts are exact lowercase hosts
- [ ] connector injected header names are lowercase

## Safety

- [ ] authenticated API or CLI flows use Secret Injection rather than exposing credentials to tool code or sandboxed processes
- [ ] authenticated egress is restricted to the minimum required provider domains or narrow wildcards
- [ ] destructive actions require an explicit confirmation field or policy
- [ ] expected failures return `toolError(...)`
- [ ] provider failures map to `provider_error`
- [ ] oversized provider errors are clipped or summarized
- [ ] brokered HTTP truncation is handled intentionally
- [ ] `maxResponseBytes` is chosen from expected response shape, not guessed blindly

## Wiring

- [ ] the new export is added to `TOOLS` in `tools/catalog/registry.ts`
- [ ] `TOOL_CATEGORY_ORDER` is updated only if a new category was introduced
- [ ] `brokered_http`, `sdk`, and `repo_workspace` capabilities use exact connector ids
- [ ] `tool_sandbox` manifest ids exactly match the sandbox manifest
- [ ] `repo_workspace` tools do not declare a sandbox manifest or use `ctx.sandbox.run`
- [ ] bundled sandbox tools prove that child tools receive the expected bundle-level sandbox manifest at runtime
- [ ] sandbox manifests bundle setup-script bytes from `tools/sandboxes/<id>/setup.ts` through the registry rather than reading repo-relative `.sh` files at runtime
- [ ] authenticated connectors or sandbox manifests enforce Secret Injection and restricted network policy where applicable
- [ ] any newly introduced runtime abstraction lives in a provider-agnostic reusable module instead of one provider-specific implementation file, unless the behavior is truly provider-specific

## OAuth-Specific Checks

- [ ] the maintainer tool does not implement OAuth start/callback/token refresh directly
- [ ] OAuth client env vars, token URLs, revoke URL, default scopes, and profile lookup live on the connector
- [ ] OAuth connector env vars are surfaced through `validateConnectorRuntimeConfig` as readable setup errors
- [ ] non-test environments with OAuth connectors have `KV_REST_API_URL` and `KV_REST_API_TOKEN` for refresh locking
- [ ] tool-level `requiredScopes` describe the endpoint surface the tool can call
- [ ] missing scopes surface as setup issues rather than runtime surprises
- [ ] if provider tier limitations affect scopes, the connector or tool description says so
- [ ] user-context and app-only tools are separate when they expose different API surfaces

## Know What Is Automatic

These surfaces already work from normal registry wiring:

- `buildAttachedTools` in `tools/runtime/build-attached-tools.ts` builds the AI SDK tool closure from the planned attachment
- `buildAgent` exposes attached maintainer tools alongside memory and exec tools
- capability summaries pick up tool display names, descriptions, connectors, and setup issues from the registry/runtime
- connection availability handles missing connector rows, invalid connections, and missing OAuth scopes
- tool catalog setup chips and attachment forms use connector metadata

Do not add manual plumbing for these unless the new tool truly breaks the standard pattern.

## Suggested Verification

- [ ] re-read the new tool file once after editing
- [ ] re-read the registry entry once after editing
- [ ] re-read `connections/registry.ts` if you introduced or changed a connector
- [ ] re-read any connector broker or sandbox network policy touched by the authenticated integration
- [ ] run focused tests for policy, request building, response handling, and bundle child exposure when applicable
- [ ] run `pnpm check` when the change is non-trivial or shared types moved
- [ ] run `pnpm test:typecheck` when touching shared runtime types or connector credential types
- [ ] clearly call out any missing prerequisite, such as connector config, OAuth app config, sandbox manifest, provider tier, or product policy
