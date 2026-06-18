# Proxy Rules

Scope: Next proxy behavior before route handlers run.

App proxy:
- Matches `/login`, `/dashboard`, `/agents`, `/channels`, `/connections`, `/settings`.
- Session users visiting `/login` redirect to `/dashboard`.
- Guests visiting protected routes redirect to `/login?from=<pathname>`.
- `/login` remains reachable when no session cookie is present.

Web proxy:
- Matches `/waitlist/:path*`.
- Returns 404 unless `WAITLIST_PUBLIC_ENABLED === 'true'`.
- Does not protect blog, legal, support, or root marketing routes.

API proxy:
- Matches `/api/:path*` and only applies CORS headers.
- Allowed origins come from public app/web URLs, Better Auth URL/trusted origins, and local app/web.
- Preflight returns 204 for allowed origins and 403 otherwise.
- Non-preflight requests never mirror an unknown `Origin`.

Invariants:
- Proxies do not replace route-level auth, ownership checks, BotID, or schema parsing.

Anchors: `apps/app/proxy.ts`, `apps/web/proxy.ts`, `apps/api/proxy.ts`.
