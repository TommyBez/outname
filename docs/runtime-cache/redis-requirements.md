# Redis Requirements
Scope: Which runtime paths require Redis and which only use cache acceleration.
Upstash KV:
- `getUpstashRedis()` reads `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
- Missing Upstash env returns `null`; inference credential cache and file caches become no-op.
- Waitlist public submit fails closed with 503 when its Redis rate limiter is unavailable.
- OAuth connectors require Upstash env outside tests because refresh locks are mandatory.
Redis URL:
- Slack Chat SDK state uses `REDIS_URL`, not Upstash KV env.
- Missing `REDIS_URL` throws `REDIS_URL is required for slack Chat SDK state.`
- The Slack state stores locks, queues, dedupe, subscriptions, and ephemeral state under `slack-chat-sdk`.
Locks:
- Generic Redis locks use `SET nx ex` and delete only if the stored token still matches.
- OAuth refresh uses `oauth-refresh:{userId}:{connectorId}` with a 10-second TTL.
- Waiting refresh callers poll up to 50 times with 250ms plus jitter.
Anchors:
- `packages/shared/server/upstash-redis.ts`
- `packages/shared/channels/server/backing-state.ts`
- `packages/shared/connections/runtime/credential.ts`
- Tests: `packages/shared/channels/server/backing-state.test.ts`
- Tests: `packages/shared/connections/registry.test.ts`, `packages/shared/connections/runtime/credential.test.ts`
