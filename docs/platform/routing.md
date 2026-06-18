# Platform Routing

Scope: package boundaries and request routing between deployed workspaces.

Surfaces:
- `apps/web` is public marketing/blog/waitlist on port 3002.
- `apps/app` is authenticated product UI on port 3000.
- `apps/api` owns product API routes on port 3001.
- `apps/email` previews React Email templates only.
- `apps/video` previews and renders Remotion launch assets only.

Routing contracts:
- App and web Next configs use shared API rewrites for `/api/:path*`.
- API Next config is the upstream target and does not rewrite `/api`.
- App root redirects to `/dashboard`; app proxy guards protected product routes.
- Web proxy only gates `/waitlist/:path*`; blog/legal/support are public.
- API route files live under `apps/api/app/api`, except app internal revalidation.
- `apps/app/app/api/internal/revalidate` is app-only and HMAC protected.

Failure modes:
- Related-project misses use local origins, so prod links must be configured.
- Rewrites do not replace route-level auth, CORS, BotID, or payload validation.

Anchors: `apps/*/next.config.ts`, `apps/*/proxy.ts`,
`packages/shared/next/create-outname-next-config.ts`,
`apps/api/app/api`, `apps/app/app/api/internal/revalidate/route.ts`.
