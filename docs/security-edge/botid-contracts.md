# BotID Contracts

Scope: client and server BotID protection for sensitive public POST routes.

Client contract:
- App and web instrumentation both call `initBotId`.
- Protected route list includes auth OTP, auth POSTs, waitlist submit, and confirmation POST.
- Protection metadata uses the shared `BOTID_CHECK_LEVEL`, currently `basic`.

Server contract:
- `denyIfBot(request)` is a no-op unless `BOTID_ENABLED === 'true'`.
- Extra allowed hosts derive from public app/web URLs and Better Auth trusted origins.
- Auth catch-all protects POST but exports Better Auth GET unchanged.
- Request OTP, waitlist submit, and waitlist confirm call `denyIfBot` before parsing.

Failure modes:
- Bot verdict returns 403 JSON `{ error: 'Access denied' }`.
- Missing BotID env disables checks; rate limits and schema validation still apply.
- BotID is not CORS and does not authenticate a user.

Anchors: `packages/shared/server/botid-config.ts`,
`packages/shared/server/botid-guard.ts`, `apps/*/instrumentation-client.ts`,
`apps/api/app/api/auth/*`, `apps/api/app/api/waitlist/*`.
