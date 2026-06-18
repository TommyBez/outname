# Waitlist
Scope: Public demand capture, email confirmation, admin invitation, and provisioning for disabled public signup.
Flow:
- Public submit requires feature flag, bot guard, Redis rate limit, honeypot check, and payload validation.
- New submissions normalize email, create `pending`, store a SHA-256 token hash, and email a 7-day token.
- Pending resubmits update fields; within 60 seconds no email is sent, after cooldown the token rotates.
- Confirmation consumes only pending, unexpired, matching tokens, then sets `confirmed` and clears token fields.
- Admin invite provisions before email, then marks `invited`; admin can convert or unsubscribe.
State:
- Statuses are `pending`, `confirmed`, `invited`, `converted`, and `unsubscribed`.
- `waitlist_entries.email` is unique and stores source/referrer/UTM, interest/profile, notes, and provisioning timestamps.
Anchors:
- `apps/api/app/api/waitlist/route.ts`, `confirm/route.ts`, `packages/db/schema/waitlist.ts`
- `packages/shared/waitlist/server/service.ts`, `actions.ts`, `constants.ts`, `token.ts`, `rate-limit.ts`
- `apps/api/app/api/auth/request-otp/route.ts`
Invariants:
- Public forms never move terminal statuses backward or reopen inactive access.
- Confirmation tokens are hashed at rest and one-use through status, hash, and expiry predicates.
- OTP login can provision `invited`/`converted` unknown users; absent, pending, confirmed, and unsubscribed are refused.
Failure modes:
- Public disabled returns 404; no Redis rate limiter returns 503; rate limit returns 429.
- Bad JSON/payload returns 400; honeypot returns generic success; unsubscribed admin direct invite throws.
