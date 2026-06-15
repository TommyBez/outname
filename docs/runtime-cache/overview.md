# Runtime Cache

Scope/boundary: Runtime cache is optional Upstash Redis for hot reads,
single-flight locks, and transient runtime coordination; databases/sandboxes stay canonical.

Flow/state:
- `getUpstashRedis()` memoizes a Redis REST client from `KV_REST_API_URL` and token.
- Missing KV env returns `null`; callers choose fail-open, no-op, or fail-closed.
- Agent memory file cache stores per-agent path indexes and encoded path records.
- Inference credential cache stores encrypted blobs by user/provider.
- Locks use `SET nx ex` with a random token and delete only if the token still matches.

Invariants:
- The helper should not throw just because Redis is unconfigured.
- File and inference caches are acceleration only; sandbox and Postgres are sources of truth.
- OAuth token refresh locking requires Redis and fails closed when unavailable.
- Lock users must choose TTLs and tolerate contention.

Failure modes:
- No Redis means empty/no-op file and inference caches.
- Generic `withRedisLock` returns `null` on contention and runs without Redis when absent.
- OAuth refresh throws `Redis is required for OAuth token refresh locking.`
- Redis read/write errors are caller-owned; the helper only constructs the client.

Anchors: `packages/shared/server/upstash-redis.ts`,
`packages/ai/agent-runtime/server/file-cache.ts`,
`packages/ai/agent-runtime/server/redis-lock.ts`,
`packages/shared/server/inference-credentials.ts`,
`packages/shared/connections/runtime/credential.ts`,
`apps/api/app/api/cron/liveness/route.ts`.
