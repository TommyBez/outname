# OTP Flow
Scope: Sign-in gate for waitlist-provisioned Better Auth users.
Better Auth:
- Email OTP sign-up is disabled; public users cannot self-create through Better Auth.
- OTPs are 6 digits, expire after 10 minutes, rotate on resend, and allow 5 attempts.
- Sessions last 30 days and update at most once per day.
- Admin users get `waitlist:manage` and `slack:use`; normal users do not.
Request route:
- POST `/api/auth/request-otp` runs bot guard before reading JSON.
- IP and normalized-email limits are each 3 requests per minute.
- Redis-backed limits use Upstash KV; otherwise process-local buckets are used.
- Existing auth users receive OTP immediately after validation.
Waitlist gate:
- No row, `pending`, `confirmed`, and `unsubscribed` return 403 with specific messages.
- `invited` and `converted` entries are provisioned before Better Auth sends the OTP.
- POST `/api/auth/[...all]` also runs bot guard before delegating to Better Auth.
Anchors:
- `packages/auth/server/auth.ts`, `packages/auth/server/request-otp-rate-limit.ts`
- `packages/auth/server/auth-guard.ts`
- `packages/auth/access-control.ts`, `packages/db/schema/auth.ts`
- Tests: `packages/db/schema/auth.test.ts`
