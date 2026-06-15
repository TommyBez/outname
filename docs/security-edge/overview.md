# Security Edge

Scope/boundary: Edge/request guards handle coarse access before route logic:
app auth redirects, public waitlist exposure, API CORS, and BotID POST checks.

Flow/state:
- App proxy sends session users away from `/login` and guests to `/login?from=...`.
- Web proxy returns 404 for `/waitlist/*` unless `WAITLIST_PUBLIC_ENABLED=true`.
- API proxy allows CORS only for configured/trusted origins plus local dev origins.
- App/web clients initialize BotID for protected auth and waitlist POST routes.
- API handlers call `denyIfBot(request)` before parsing sensitive POST payloads.

Invariants:
- CORS never mirrors an unknown `Origin`; disallowed preflights return 403.
- BotID is disabled unless `BOTID_ENABLED === 'true'`.
- BotID extra allowed hosts come from public app/web URLs and trusted origins.
- Waitlist API checks the public flag too; the web proxy is not sole enforcement.
- Better Auth GET remains the handler GET; protected auth POST runs through BotID.

Failure modes:
- BotID-positive requests return 403 `{ error: 'Access denied' }`.
- Unauthenticated app routes redirect; hidden waitlist pages return 404.
- Missing or untrusted CORS origin gets no allow headers, or 403 for preflight.

Anchors: `apps/app/proxy.ts`, `apps/web/proxy.ts`, `apps/api/proxy.ts`,
`packages/shared/server/botid-guard.ts`,
`packages/shared/server/botid-config.ts`,
`apps/*/instrumentation-client.ts`,
`apps/api/app/api/auth/*`, `apps/api/app/api/waitlist/*`.
