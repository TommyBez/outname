# Maintainer Tool Validation Checklist

Use this checklist before closing a maintainer-tool task.

## Shape

- [ ] `id` is unique and stable
- [ ] `displayName` is clear in the catalog UI
- [ ] `description` explains the tool's purpose without leaking implementation noise
- [ ] `configSchema` only contains attachment defaults
- [ ] `inputSchema` only contains per-call arguments
- [ ] important fields use `describe(...)`
- [ ] returned data is compact, structured, and useful to the model

## Safety

- [ ] no raw credentials, tokens, or secrets were added to tool config or inputs
- [ ] authenticated API or CLI flows use Secret Injection rather than exposing credentials to tool code or sandboxed processes
- [ ] authenticated egress is restricted to the minimum required provider domains or narrow wildcards
- [ ] destructive actions require an explicit confirmation field or policy
- [ ] expected failures return `toolError(...)`
- [ ] provider failures map to `provider_error`
- [ ] oversized provider errors are clipped or summarized

## Wiring

- [ ] the new export is added to `TOOLS` in `tools/catalog/registry.ts`
- [ ] `TOOL_CATEGORY_ORDER` is updated only if a new category was introduced
- [ ] `brokered_http` provider names exactly match the connector runtime, if used
- [ ] `tool_sandbox` manifest ids exactly match the sandbox manifest, if used
- [ ] sandbox manifests bundle setup-script bytes from `tools/sandboxes/<id>/setup.ts` through the registry, rather than reading repo-relative `.sh` files at runtime
- [ ] authenticated connectors or sandbox manifests enforce Secret Injection and restricted network policy where applicable

## Know What Is Automatic

These surfaces already work from normal registry wiring:

- `buildAttachedTools` in `tools/runtime/build-attached-tools.ts` builds the AI SDK tool closure from the planned attachment
- `buildAgent` exposes attached maintainer tools alongside memory and exec tools
- capability summaries in `agents/server/capability-summary.ts` pick up tool display names and descriptions from the registry

Do not add manual plumbing for these unless the new tool truly breaks the standard pattern.

## Suggested Verification

- [ ] re-read the new tool file once after editing
- [ ] re-read the registry entry once after editing
- [ ] re-read `connections/registry.ts` too if you introduced a new brokered HTTP provider
- [ ] re-read any connector or sandbox network policy setup touched by the authenticated integration
- [ ] run `pnpm check` when the change is non-trivial or shared types moved
- [ ] clearly call out any missing prerequisite, such as a connector, sandbox manifest, or product policy
