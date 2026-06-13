# Product Hunt Email Sequence

These emails are implemented in `packages/email/product-hunt-launch-email.tsx` and sent by `/api/cron/product-hunt-launch`.

## Event: `vercel-day-reminder`

Window: June 15, 2026, 08:30-20:00 UTC

Subject: OUTNA.ME launches on Product Hunt this Tuesday

Purpose: warm confirmed waitlist members and set the correct ask: feedback, not upvotes.

## Event: `vercel-day-live`

Window: June 16, 2026, 07:05-20:00 UTC

Subject: OUTNA.ME is live on Product Hunt

Requirement: `PRODUCT_HUNT_LAUNCH_URL` must be set. The cron skips this event if the URL is missing. It is mutually exclusive with `vercel-day-live-fallback` per recipient.

Purpose: send confirmed waitlist members to the Product Hunt page for comments, questions, and honest feedback.

## Event: `vercel-day-live-fallback`

Window: June 16, 2026, 08:15-20:00 UTC

Subject: OUTNA.ME Vercel Day launch page is live

Requirement: sent only if `PRODUCT_HUNT_LAUNCH_URL` is still missing after the launch window opens. It is mutually exclusive with `vercel-day-live` per recipient.

Purpose: keep the owned-channel launch moving without pretending there is a Product Hunt URL. Sends people to the launch landing page for feedback.

## Event: `vercel-day-recap`

Window: June 17, 2026, 08:30-18:00 UTC

Subject: OUTNA.ME Product Hunt launch follow-up

Requirement: `PRODUCT_HUNT_LAUNCH_URL` must be set. It is mutually exclusive with `vercel-day-recap-fallback` per recipient.

Purpose: convert launch attention into product feedback and early-access expectations.

## Event: `vercel-day-recap-fallback`

Window: June 17, 2026, 10:00-18:00 UTC

Subject: OUTNA.ME Vercel Day launch follow-up

Requirement: sent only if `PRODUCT_HUNT_LAUNCH_URL` is still missing on June 17. It is mutually exclusive with `vercel-day-recap` per recipient.

Purpose: keep the post-launch feedback loop open on the landing page when Product Hunt remains unavailable to automation.
