# Product Hunt Vercel Day Launch

Launch date: Tuesday, June 16, 2026  
Product Hunt start: 12:01 AM Pacific / 09:01 CEST  
Landing page: `https://outna.me/product-hunt`  
Campaign: `vercel-day-2026`

## What Is Automated

- `/product-hunt` renders a launch-specific landing page with Vercel Day positioning.
- `/product-hunt#launch-feedback` captures fallback launch feedback when Product Hunt comments are unavailable.
- The homepage shows a Product Hunt/Vercel Day launch panel until the post-launch window ends.
- `/api/cron/product-hunt-launch` runs every 15 minutes on Vercel.
- Waitlist emails are sent idempotently by event window:
  - `vercel-day-reminder`: June 15, 08:30-20:00 UTC.
  - `vercel-day-live`: June 16, 07:05-20:00 UTC, only if the Product Hunt URL is set.
  - `vercel-day-live-fallback`: June 16, 08:15-20:00 UTC, only if the Product Hunt URL is still missing. Mutually exclusive with `vercel-day-live` per recipient.
  - `vercel-day-recap`: June 17, 08:30-18:00 UTC, only if the Product Hunt URL is set.
  - `vercel-day-recap-fallback`: June 17, 10:00-18:00 UTC, only if the Product Hunt URL is still missing. Mutually exclusive with `vercel-day-recap` per recipient.
- Typefully social drafts are created/scheduled idempotently from an explicit launch Typefully configuration. The cron never falls back to the first stored Typefully account.
- Product Hunt social posts that need the live Product Hunt URL are skipped until `PRODUCT_HUNT_LAUNCH_URL` is set.
- Vercel Preview runs can use their preview database and migrations, but `/api/cron/product-hunt-launch` returns before any Resend, Typefully, admin notification, or admin digest side effect when `VERCEL_ENV=preview`. The email, Typefully, and admin digest automation functions also have their own preview guards, so a future non-cron caller still skips before DB lookup, `fetch`, Resend, or delivery work in preview.
- The cron response includes a non-secret `readiness` snapshot. In preview this can be used to validate configuration shape while still exiting before Redis, Product Hunt discovery, Resend, Typefully, admin notifications, and admin digest delivery.
- During and after the launch window, the cron and public landing pages also probe default Product Hunt post URL candidates (`/posts/outna-me`, `/posts/outna-me-2`, `/posts/outname`, `/posts/outname-2`, `/posts/outna-me-vercel-day`, `/posts/outname-vercel-day`) and optional `PRODUCT_HUNT_LAUNCH_URL_CANDIDATES` values. If a public post page is reachable and contains OUTNA.ME identity plus launch-context markers, the system uses that URL for live Product Hunt emails, social posts, and launch CTAs without requiring a manual env update. Candidate probes run in parallel and cache briefly so the landing page is not blocked by sequential Product Hunt fetches.
- The cron also reads recent `launch_feedback.referrer` and Product Hunt waitlist `referrer` values as URL handoff candidates. These DB-derived URLs are still probed for OUTNA.ME/Product Hunt markers before use, so a client-supplied referrer cannot become the live URL without public page verification.
- The June 13 pre-launch social posts are allowed to backfill until June 15, 07:00 UTC if the PR is merged after the planned Saturday slot. After that cutoff, the Monday reminder becomes the next public social touchpoint.
- Fallback social posts are scheduled only when their fallback window is near and the Product Hunt URL is still missing; they send people to the launch landing page with explicit fallback copy.
- Email unsubscribe links are signed and handled by `/api/waitlist/unsubscribe`.
- Email and social automation degrade independently. A failed email recipient increments that event's `failed` count without blocking the rest of the batch, and a section-level email or Typefully failure is returned in the cron JSON without preventing the other channel from running.
- In production, alertable cron issues such as section failures, email recipient failures, Typefully setup failures, Typefully request failures, missing Typefully connections, expired social post windows, URL handoff failures, or admin digest failures send an idempotent admin notification. Preview deployments suppress this notification together with the other external launch side effects.
- In production, the cron sends idempotent admin digest checkpoints for pre-launch readiness, launch-day start, launch-day evening, and post-launch recap. Each digest summarizes Product Hunt-attributed waitlist signups, feedback, launch email delivery records, Typefully delivery records, current issues, and Product Hunt URL resolution. Preview deployments skip the digest before DB lookup or Resend.

## Required Product Hunt Setup

Product Hunt does not expose a safe public API for scheduling a launch post. The listing still has to be created through a logged-in Product Hunt account.

Current external constraint, June 13, 2026: automated browser attempts with the local Chrome profiles `Default`, `Profile 3 (Tommaso)`, and `Profile 1` all stopped on Product Hunt's Cloudflare human-verification screen before the launch form. Do not automate clicks against that verification. If a human can complete the Product Hunt UI, use the listing content and gallery assets below, then set the final Product Hunt URL in Vercel.

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

Without this URL, the cron intentionally skips Product Hunt-specific live/recap messages instead of publishing placeholder links. Fallback email and social messages point to the launch landing page and explicitly state that the Product Hunt URL was not available to automation. If visitors arrive from Product Hunt first, their feedback and waitlist referrers can hand the final post URL back to cron automatically after the launch window opens.

## Email Automation

The launch cron runs the email automation every 15 minutes, but sends only inside the configured event windows. It never sends cold outreach: recipients come from waitlist entries whose status is `confirmed`, `invited`, or `converted`.

User-facing waitlist emails:

- `vercel-day-reminder`: sent on June 15, 08:30-20:00 UTC. It tells confirmed waitlist users that OUTNA.ME is planned for Product Hunt Vercel Day and asks for honest launch feedback, not upvotes.
- `vercel-day-live`: sent on June 16, 07:05-20:00 UTC only when the real Product Hunt URL has been resolved.
- `vercel-day-live-fallback`: sent on June 16, 08:15-20:00 UTC only while the Product Hunt URL is still unresolved. It links to `/product-hunt` and explicitly says the Product Hunt URL was not available to automation.
- `vercel-day-recap`: sent on June 17, 08:30-18:00 UTC only when the real Product Hunt URL has been resolved.
- `vercel-day-recap-fallback`: sent on June 17, 10:00-18:00 UTC only while the Product Hunt URL is still unresolved. It keeps the feedback loop on `/product-hunt`.

The live and live-fallback emails are mutually exclusive per recipient. The recap and recap-fallback emails are mutually exclusive per recipient. This prevents a waitlist user from receiving both the Product Hunt URL version and the fallback landing-page version for the same launch moment.

Delivery is idempotent at two levels:

- `waitlist_launch_email_deliveries` records each sent waitlist recipient/event pair, including the Resend message id.
- Resend receives an idempotency key for each recipient/event pair.

The batch size is controlled by `PRODUCT_HUNT_LAUNCH_EMAIL_BATCH_SIZE`. Runtime clamps invalid or excessive values and never uses more than 200 recipients per cron run. A single recipient failure is counted for that event but does not stop the rest of the batch or the Typefully automation.

Every waitlist launch email includes a signed unsubscribe link handled by `/api/waitlist/unsubscribe`.

Admin email automation is separate from waitlist delivery:

- Issue notifications go to `WAITLIST_ADMIN_EMAIL` when the cron detects alertable problems, such as email recipient failures, URL handoff failures, Typefully setup/request failures, or admin digest failures.
- Admin digests go to `WAITLIST_ADMIN_EMAIL` at pre-launch readiness, launch-day start, launch-day evening, and post-launch recap checkpoints. Each digest summarizes current cron results, Product Hunt-attributed waitlist signups, feedback submissions, recorded launch email deliveries, Typefully delivery records, current issues, and Product Hunt URL resolution.

Preview deployments skip all Resend side effects before delivery work starts. This includes waitlist emails, issue notifications, feedback notifications, and admin digests.

## Vercel Env

Required:

```bash
CRON_SECRET=<existing cron secret>
PRODUCT_HUNT_LAUNCH_AUTOMATION_ENABLED=true
PRODUCT_HUNT_LAUNCH_EMAIL_BATCH_SIZE=50
PRODUCT_HUNT_SOCIAL_AUTOMATION_ENABLED=true
PRODUCT_HUNT_SOCIAL_ATTACH_MEDIA=true
PRODUCT_HUNT_TYPEFULLY_API_KEY=<Typefully API key for the launch account>
PRODUCT_HUNT_LAUNCH_URL_CANDIDATES=https://www.producthunt.com/posts/outna-me,https://www.producthunt.com/posts/outna-me-2,https://www.producthunt.com/posts/outname,https://www.producthunt.com/posts/outname-2,https://www.producthunt.com/posts/outna-me-vercel-day,https://www.producthunt.com/posts/outname-vercel-day
```

Optional:

```bash
PRODUCT_HUNT_TYPEFULLY_SOCIAL_SET_ID=<typefully social set id>
PRODUCT_HUNT_TYPEFULLY_USER_ID=<user id that owns the typefully connection>
```

Recommended Typefully setup: set `PRODUCT_HUNT_TYPEFULLY_API_KEY` and `PRODUCT_HUNT_TYPEFULLY_SOCIAL_SET_ID`. If the social set ID is omitted, automation only proceeds when the API key exposes exactly one social set; if multiple social sets are available, social automation skips and raises an alert instead of guessing.

Fallback Typefully setup: if you do not want to store the API key in Vercel env, set both `PRODUCT_HUNT_TYPEFULLY_USER_ID` and `PRODUCT_HUNT_TYPEFULLY_SOCIAL_SET_ID` so the cron can read that specific user's encrypted `typefully.api_key` connection. `PRODUCT_HUNT_TYPEFULLY_USER_ID` alone is not enough.

## Database

The launch automation uses three idempotency tables plus one feedback table:

- `waitlist_launch_email_deliveries`
- `launch_social_post_deliveries`
- `launch_admin_digest_deliveries`
- `launch_feedback`

The migrations are:

- `packages/db/drizzle/0022_waitlist_launch_email_deliveries.sql`
- `packages/db/drizzle/0023_launch_social_post_deliveries.sql`
- `packages/db/drizzle/0024_launch_feedback.sql`
- `packages/db/drizzle/0025_launch_admin_digest_deliveries.sql`

## Assets

Product Hunt upload assets live in:

- `packages/shared/content/product-hunt-vercel-day/gallery`

Public social-upload assets live in:

- `apps/web/public/product-hunt-vercel-day`

## Compliance

Do ask for comments, questions, feedback, and criticism.

Do not ask for upvotes, run contests tied to Product Hunt votes, or send cold unsolicited DMs.
