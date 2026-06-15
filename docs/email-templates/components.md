# Components

Scope: React Email template contracts in `packages/email`.

Layout contract:
- All templates render through `WaitlistEmailLayout`.
- Layout owns HTML, Tailwind, preview text, logo, heading, lead, body, footer.
- CTA renders only when both `ctaHref` and `ctaLabel` exist.
- CTA emails include a copy-paste URL fallback below the button.
- Logo URL is a prop; production callers should pass the web-hosted logo URL.
- Theme uses React Email `pixelBasedPreset` and black/white/red tokens.

Template contract:
- Each template defines typed props and `PreviewProps`.
- OTP email keeps expiry, single-use language, and the code near the top.
- Confirmation email sends users to a confirmation page before final action.
- Admin signup email reports unconfirmed signup state and attribution fields.
- Invite emails include `InferenceProviderSetupNote`.

Failure modes:
- Missing CTA props intentionally omits both button and fallback URL.
- Preview URLs are examples only and must not be treated as send-time config.

Anchors: `packages/email/components/waitlist-email-layout.tsx`,
`packages/email/*email.tsx`, `packages/email/waitlist-email-theme.ts`,
`packages/email/email-preview-urls.ts`.
