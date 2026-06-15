# Email Templates

Mini-spec for transactional emails in `packages/email` and preview via `apps/email`.

Surface:
- `apps/email` runs `email dev --dir ../../packages/email --port 3004`.
- Templates are React Email components exported from `packages/email`.
- All templates use `WaitlistEmailLayout` and `waitlistEmailTailwind`.
- Preview-only URLs live in `EMAIL_PREVIEW_URLS`.
- Production logo URLs should use `/email/outna-logo.png` served by `apps/web`.

Templates:
- `AuthSignInOtpEmail`: one-time code, expiry, login URL, logo URL.
- `WaitlistConfirmationEmail`: confirmation URL and confirmation-page safety copy.
- `WaitlistAdminSignupEmail`: signup details, admin URL, and collapsed UTM data.
- `WaitlistInviteEmail`: login URL for an account prepared from the waitlist.
- `ApplicationInviteEmail`: login URL and invite copy from site metadata.

Invariants:
- A CTA renders only when both `ctaHref` and `ctaLabel` are present.
- CTA emails always include a copy-paste URL fallback.
- Every template must define `PreviewProps` for React Email previews.
- Invite emails include `InferenceProviderSetupNote` for provider-key setup.
- OTP copy must keep expiry and single-use language visible near the code.
- Admin signup mail must not imply the address is already confirmed.
