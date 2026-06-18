# Environment Matrix

Scope: runtime and build-time env wiring across the app, API, web, email, and
video workspaces.

Matrix:
- Root requires Node `>=24`, pnpm `>=10`, and Turborepo scripts from `package.json`.
- Local origins are app `:3000`, API `:3001`, web `:3002`.
- Email preview runs `email dev --dir ../../packages/email --port 3004`.
- Video Studio runs `remotion studio remotion/index.ts --port=3005`.
- `createOutnameNextConfig` injects `NEXT_PUBLIC_API_BASE_URL`,
  `NEXT_PUBLIC_APP_URL`, and `NEXT_PUBLIC_WEB_URL` per role.
- App/web roles rewrite `/api/:path*` to the API origin; API role has no rewrite.
- Preview origins prefer `VERCEL_URL`; production prefers
  `VERCEL_PROJECT_PRODUCTION_URL`, then `VERCEL_URL`.
- Cross-project app cache refresh needs `APP_REVALIDATION_SECRET`.
- Protected Vercel previews may also need `APP_VERCEL_AUTOMATION_BYPASS_SECRET`.
- Email sending needs `RESEND_API_KEY` plus auth or waitlist from/reply-to envs.
- `WAITLIST_PUBLIC_ENABLED=true` exposes public waitlist web/API behavior.
- `BOTID_ENABLED=true` turns route-level BotID checks on.

Failure modes:
- Missing revalidation secret, Resend key, or email from/reply-to env throws.
- Missing related project URLs fall back to local defaults when guessing is unsafe.

Anchors: `package.json`, `packages/shared/next/create-outname-next-config.ts`,
`packages/shared/vercel-related-projects.ts`, `packages/shared/server/email-urls.ts`.
Tests: `packages/shared/next/create-outname-next-config.test.ts`,
`packages/shared/vercel-related-projects.test.ts`, `packages/shared/server/email-urls.test.ts`.
