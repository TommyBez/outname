# Auth Account
Scope: Better Auth identity, sessions, roles, OTP sign-in, and waitlist-gated provisioning; public signup is disabled.
Flow:
- `/api/auth/request-otp` denies bots, rate-limits by IP/email, normalizes email, and checks access.
- Existing users get OTP; unknown `invited`/`converted` waitlist entries are provisioned first.
- Better Auth sends six-digit sign-in OTPs, rotates on resend, allows five attempts, and expires in 10 minutes.
- `/api/auth/[...all]` delegates to Better Auth; POST also runs the bot guard.
State:
- `user` stores email, verified flag, timezone, role, ban flags, and default inference provider; `session` lasts 30 days.
- `account` stores provider token fields; `verification` stores OTP values and expiry.
Anchors:
- `packages/auth/server/auth.ts`, `auth-guard.ts`, `request-otp-rate-limit.ts`, `access-control.ts`
- `apps/api/app/api/auth/request-otp/route.ts`, `apps/api/app/api/auth/[...all]/route.ts`
- `packages/db/schema/auth.ts`, `packages/shared/waitlist/server/service.ts`
Invariants:
- User creation comes from waitlist/admin provisioning, never public Better Auth signup.
- OTP request limits are three per minute per IP and three per minute per email.
- `requireSession` redirects to `/login`; waitlist and Slack gates use Better Auth permissions.
- Admin role has `waitlist:manage` and `slack:use`; user role does not.
Failure modes:
- Missing, pending, confirmed, or unsubscribed waitlist entries are refused before OTP send.
- Bad JSON/email returns 400, rate limit returns 429, OTP send failure returns 500.
