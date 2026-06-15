# Waitlist Status Transitions
Scope: Public waitlist, admin invite, and OTP provisioning gates.
Statuses:
- `pending`: public submit created or updated a row and issued a 7-day hashed confirmation token.
- `confirmed`: token consumption matched hash, status, and expiry, then cleared token fields.
- `invited`: admin prepared invite, provisioned access, sent mail, then marked invite timestamps.
- `converted`: admin terminal success state; OTP can still provision an unknown auth user.
- `unsubscribed`: inactive; public resubmits only patch metadata and OTP is refused.
Public flow:
- Public submit requires feature flag, bot guard, Redis limiter, honeypot, and schema validation.
- Rate limit is 10 requests per 10 minutes per IP; missing Redis returns 503.
- Pending resubmit within 60 seconds patches fields without email; after cooldown token rotates.
Admin/auth flow:
- Admin direct invite creates `confirmed` rows with `source = admin-invite` or promotes `pending`.
- Provisioning is allowed for `confirmed`, `invited`, and `converted` entries.
- OTP request provisions unknown users only for `invited` or `converted`; pending and confirmed are refused.
Anchors:
- `packages/shared/waitlist/server/service.ts`, `packages/shared/waitlist/server/constants.ts`
- `packages/shared/waitlist/server/token.ts`, `packages/shared/waitlist/server/rate-limit.ts`
- `apps/api/app/api/waitlist/route.ts`, `apps/api/app/api/waitlist/confirm/route.ts`
- `apps/api/app/api/auth/request-otp/route.ts`
- Test anchor/gap: `packages/shared/server/email-urls.test.ts`; no dedicated waitlist transition test exists.
