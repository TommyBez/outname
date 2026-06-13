# Product Hunt Email Sequence

These emails are implemented in `packages/email/product-hunt-launch-email.tsx` and sent by `/api/cron/product-hunt-launch`.

## Event: `vercel-day-reminder`

Window: June 15, 2026, 08:30-20:00 UTC

Subject: OUTNA.ME launches on Product Hunt this Tuesday

Purpose: warm confirmed waitlist members and set the correct ask: feedback, not upvotes.

## Event: `vercel-day-live`

Window: June 16, 2026, 07:05-20:00 UTC

Subject: OUTNA.ME is live on Product Hunt

Requirement: `PRODUCT_HUNT_LAUNCH_URL` must be set. The cron skips this event if the URL is missing.

Purpose: send confirmed waitlist members to the Product Hunt page for comments, questions, and honest feedback.

## Event: `vercel-day-recap`

Window: June 17, 2026, 08:30-18:00 UTC

Subject: OUTNA.ME Product Hunt launch follow-up

Requirement: `PRODUCT_HUNT_LAUNCH_URL` must be set.

Purpose: convert launch attention into product feedback and early-access expectations.
