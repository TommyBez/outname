# Credential Taxonomy
Scope: Which secrets exist, where they live, and who may see them.
Kinds:
- Better Auth `account` tokens are identity provider fields, not broker connector credentials.
- API-key connectors store `{ kind: "api_key", values }` in `user_connections.credentials`.
- OAuth connectors store `{ kind: "oauth2", version: 1, tokenType: "Bearer", accessToken, refreshToken? }`.
- Slack installs store `{ botToken }` in `channel_installations.credentials`; team metadata stays clear.
- Inference providers store `{ apiKey }` in `user_inference_credentials.encrypted_credentials`.
- Waitlist confirmation tokens are SHA-256 hashes, not decryptable credentials.
Scoping:
- Tool credentials are keyed by `(user_id, connector_id)` and expose clear status, expiry, metadata, and scopes.
- Inference credentials are keyed by `(user_id, inference_provider)` with `enabled` or `invalid` status.
- Slack installs are unique by `(user_id, channel, external_id)` so users can share a workspace safely.
Security:
- `encryptCredential` writes AES-GCM `version | iv | tag | ciphertext` using a 32-byte `CONNECTION_ENCRYPTION_KEY`.
- Tool VMs do not receive raw credentials; brokers inject declared headers outside the VM.
- OAuth refresh requires Redis single-flight locking; bad decrypt or invalid shape marks the row invalid.
Anchors:
- `packages/shared/connections/types.ts`, `packages/shared/connections/crypto.ts`
- `packages/shared/connections/key-provider.ts`
- `packages/db/schema/connections.ts`, `packages/db/schema/channels.ts`, `packages/db/schema/inference.ts`
- `packages/db/schema/waitlist.ts`
- Tests: `packages/shared/connections/runtime/credential.test.ts`
