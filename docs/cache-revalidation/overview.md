# Cache Revalidation

Scope/boundary: Cache revalidation keeps app-side cached server data current after
local mutations and API-project mutations.

Flow/state:
- Shared tag helpers name user, agent, connection, tool, skill, budget, and chat caches.
- App-local mutations call `revalidateTag(...)` or `updateTag(...)` directly.
- API-side mutations call `revalidateAppAfter(...)` or `sendAppRevalidation(...)`.
- Cross-project sends POST JSON to the app `/api/internal/revalidate` route.
- The app route verifies HMAC, parses payload, then revalidates tags and paths.

Invariants:
- Use `packages/shared/server/cache-tags.ts`; do not inline cache tag strings.
- Payload tags are `[tag, 'max' | { expire: 0 }]`; paths must begin with `/`.
- Empty tag/path payloads are no-ops.
- Cross-project revalidation requires the app origin from related projects or env.
- Protected previews need `APP_VERCEL_AUTOMATION_BYPASS_SECRET` on the API app.

Failure modes:
- Missing `APP_REVALIDATION_SECRET` throws before signing or verification.
- Bad/missing signature returns 401; bad JSON or payload returns 400.
- `revalidateAppAfter` logs send failures after the request; direct sends throw.

Anchors: `packages/shared/server/app-revalidation*.ts`,
`packages/shared/server/cache-tags.ts`,
`apps/app/app/api/internal/revalidate/route.ts`,
`packages/shared/server/data.ts`,
`apps/api/app/api/agents/[agentId]/*`.
