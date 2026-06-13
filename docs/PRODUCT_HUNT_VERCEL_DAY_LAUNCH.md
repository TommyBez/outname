# Product Hunt Vercel Day Launch

Launch date: Tuesday, June 16, 2026  
Product Hunt start: 12:01 AM Pacific / 09:01 CEST  
Landing page: `https://outna.me/product-hunt`  
Campaign: `vercel-day-2026`

## What Is Automated

- `/product-hunt` renders a launch-specific landing page with Vercel Day positioning.
- The homepage shows a Product Hunt/Vercel Day launch panel until the post-launch window ends.
- `/api/cron/product-hunt-launch` runs every 15 minutes on Vercel.
- Waitlist emails are sent idempotently by event window:
  - `vercel-day-reminder`: June 15, 08:30-20:00 UTC.
  - `vercel-day-live`: June 16, 07:05-20:00 UTC, only if the Product Hunt URL is set.
  - `vercel-day-live-fallback`: June 16, 08:15-20:00 UTC, only if the Product Hunt URL is still missing. Mutually exclusive with `vercel-day-live` per recipient.
  - `vercel-day-recap`: June 17, 08:30-18:00 UTC, only if the Product Hunt URL is set.
  - `vercel-day-recap-fallback`: June 17, 10:00-18:00 UTC, only if the Product Hunt URL is still missing. Mutually exclusive with `vercel-day-recap` per recipient.
- Typefully social drafts are created/scheduled idempotently from the active `typefully.api_key` connection.
- Product Hunt social posts that need the live Product Hunt URL are skipped until `PRODUCT_HUNT_LAUNCH_URL` is set.
- Fallback social posts are scheduled only when their fallback window is near and the Product Hunt URL is still missing; they send people to the launch landing page with explicit fallback copy.
- Email unsubscribe links are signed and handled by `/api/waitlist/unsubscribe`.

## Required Product Hunt Setup

Product Hunt does not expose a safe public API for scheduling a launch post. The listing still has to be created through a logged-in Product Hunt account.

Use:

- Product name: `OUTNA.ME`
- Tagline: `Hosted AI agents that keep working`
- Primary URL: `https://outna.me/product-hunt`
- Topics: `Vercel Day`, `AI Agents`, `Productivity`
- Gallery:
  - `packages/shared/content/product-hunt-vercel-day/gallery/01-outname-hero.png`
  - `packages/shared/content/product-hunt-vercel-day/gallery/02-vercel-stack.png`
  - `packages/shared/content/product-hunt-vercel-day/gallery/03-agent-runtime.png`
- Copy: `packages/shared/content/product-hunt-vercel-day/product-hunt-listing.md`

Official Product Hunt launch guidance used for compliance:

- https://www.producthunt.com/launch
- https://www.producthunt.com/launch/sharing-your-launch

## Product Hunt URL Handoff

As soon as Product Hunt exposes the final post URL, set both env vars in the API and web Vercel projects:

```bash
PRODUCT_HUNT_LAUNCH_URL=https://www.producthunt.com/posts/<slug>
NEXT_PUBLIC_PRODUCT_HUNT_LAUNCH_URL=https://www.producthunt.com/posts/<slug>
```

Without this URL, the cron intentionally skips Product Hunt-specific live/recap messages instead of publishing placeholder links. Fallback email and social messages point to the launch landing page and explicitly state that the Product Hunt URL was not available to automation.

## Vercel Env

Required:

```bash
CRON_SECRET=<existing cron secret>
PRODUCT_HUNT_LAUNCH_AUTOMATION_ENABLED=true
PRODUCT_HUNT_LAUNCH_EMAIL_BATCH_SIZE=50
PRODUCT_HUNT_SOCIAL_AUTOMATION_ENABLED=true
PRODUCT_HUNT_SOCIAL_ATTACH_MEDIA=true
```

Optional:

```bash
PRODUCT_HUNT_TYPEFULLY_SOCIAL_SET_ID=<typefully social set id>
PRODUCT_HUNT_TYPEFULLY_USER_ID=<user id that owns the typefully connection>
```

If the optional Typefully values are omitted, the cron uses the first active `typefully.api_key` connection and the first accessible Typefully social set.

## Database

The launch automation uses two idempotency tables:

- `waitlist_launch_email_deliveries`
- `launch_social_post_deliveries`

The migrations are:

- `packages/db/drizzle/0021_waitlist_launch_email_deliveries.sql`
- `packages/db/drizzle/0022_launch_social_post_deliveries.sql`

## Assets

Product Hunt upload assets live in:

- `packages/shared/content/product-hunt-vercel-day/gallery`

Public social-upload assets live in:

- `apps/web/public/product-hunt-vercel-day`

## Compliance

Do ask for comments, questions, feedback, and criticism.

Do not ask for upvotes, run contests tied to Product Hunt votes, or send cold unsolicited DMs.
