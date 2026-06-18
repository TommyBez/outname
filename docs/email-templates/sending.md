# Sending

Scope: server-side email senders that use the React templates.

Flow:
- Auth OTP sends `AuthSignInOtpEmail` from `packages/auth/server/auth-email.ts`.
- Waitlist senders live in `packages/shared/waitlist/server/email.ts`.
- Senders call `sendResendReactEmail` with a React element and idempotency key.
- Resend payload includes `from`, `replyTo`, `subject`, single recipient, and React body.
- Logo URLs are built from the marketing web origin plus `/email/outna-logo.png`.
- Login/admin URLs use the app origin; waitlist confirmation uses the web origin.

Env/state:
- Auth sender requires `AUTH_FROM_EMAIL` and `AUTH_REPLY_TO`.
- Waitlist sender requires `WAITLIST_FROM_EMAIL` and `WAITLIST_REPLY_TO`.
- All Resend sends require `RESEND_API_KEY`.
- Admin signup notification is skipped when no admin email is configured.

Failure modes:
- Resend API errors throw with name, optional status code, and message.
- Waitlist route logs confirmation/admin send failures but still returns generic success.

Anchors: `packages/shared/server/resend.ts`,
`packages/shared/server/email-logo-url.ts`, `packages/shared/waitlist/server/email.ts`.
Tests: `packages/shared/server/email-urls.test.ts`.
