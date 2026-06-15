# Credentials And Connections
Scope: User-managed tool connector credentials and OAuth/API-key lifecycle; inference provider keys are separate.
Flow:
- API-key actions require a session, connector lookup, schema validation, optional provider probe, then encrypted upsert.
- OAuth start requires a session, OAuth connector, client env, signed 10-minute state, and signed PKCE cookie.
- OAuth callback requires same session user, connector, requested scope hash, and PKCE verifier before token exchange.
- Successful callbacks reject unexpected scopes, save best-effort profile metadata, and upsert the connection.
State:
- `user_connections` is keyed by `(user_id, connector_id)` with encrypted credentials and clear status/scopes/expiry/metadata.
- Credential blobs are AES-GCM envelopes using `CONNECTION_ENCRYPTION_KEY`; statuses are `active` or `invalid`.
Anchors:
- `packages/shared/connections/registry.ts`, `types.ts`, `crypto.ts`, `oauth-state.ts`
- `packages/shared/connections/runtime/store.ts`, `credential.ts`, `availability.ts`
- `apps/api/app/api/connections/oauth/[connectorId]/start/route.ts`, `callback/route.ts`
- `packages/db/schema/connections.ts`
Invariants:
- Connector ids are `provider.connector`; `providerGroup` matches the prefix.
- Tool code never receives raw credentials; the broker injects auth headers outside the tool VM.
- Runtime credential access is scoped by user id and connector id; OAuth refresh uses Redis single-flight locking.
Failure modes:
- Unknown connector, wrong auth kind, missing env, invalid state/PKCE, or unexpected scopes redirect with connection error.
- Missing/invalid connections or missing scopes produce reconnect requirements; bad decrypt/shape/permanent refresh marks invalid.
- Disconnect deletes the row and best-effort revokes OAuth tokens when supported.
