# Connector Authoring
Scope: Adding a tool connector under `packages/shared/connections/`.
Contract:
- Define API-key connectors with `defineConnector()` and OAuth connectors with `defineOAuth2Connector()`.
- Connector ids must match `provider.connector`; `providerGroup` must equal the prefix.
- Broker `allowedHosts` must be exact lowercase hosts; `injectedHeaderNames` must be lowercase.
- Form schemas should store only authentication fields; per-tool defaults belong in tool config.
API keys:
- Validate shape with Zod before persistence.
- Optional `validate()` should use a cheap provider probe and return safe metadata.
- Persisted rows are encrypted upserts in `user_connections` with status reset to `active`.
OAuth:
- Runtime env must include `KV_REST_API_URL` and `KV_REST_API_TOKEN` when OAuth connectors exist.
- Start route signs 10-minute state, hashes requested scopes, and stores a signed PKCE cookie.
- Callback rechecks session user, connector id, scope hash, PKCE, and rejects unexpected granted scopes.
- Refresh runs under `oauth-refresh:{userId}:{connectorId}` Redis lock.
Anchors:
- `packages/shared/connections/registry.ts`, `packages/shared/connections/define-connector.ts`
- `packages/shared/connections/oauth-state.ts`
- `apps/api/app/api/connections/oauth/[connectorId]/start/route.ts`
- `apps/api/app/api/connections/oauth/[connectorId]/callback/route.ts`
- Tests: `packages/shared/connections/registry.test.ts`, `packages/shared/connections/oauth-state.test.ts`
- Tests: `packages/shared/connections/runtime/availability.test.ts`, `packages/shared/connections/github.test.ts`
