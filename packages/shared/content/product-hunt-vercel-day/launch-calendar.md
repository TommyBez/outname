# Product Hunt Vercel Day Calendar

All times include both Rome time and Product Hunt launch-day context.

| Time | Channel | Automation / Asset | Purpose |
|---|---|---|---|
| Sat Jun 13, 18:00 CEST | X + LinkedIn | Typefully cron plan `2026-06-13-vercel-day-prelaunch-*` | Publicly announce the Product Hunt/Vercel Day launch and collect early waitlist traffic. |
| Mon Jun 15, 10:30 CEST | Waitlist email | `vercel-day-reminder` cron window starts 08:30 UTC | Warm confirmed waitlist members. |
| Mon Jun 15, 11:30 CEST | X + LinkedIn | Typefully cron plan `2026-06-15-tomorrow-reminder-*` | Remind public audience without asking for votes. |
| Tue Jun 16, 00:01 PDT / 09:01 CEST | Product Hunt | Listing goes live with tag `Vercel Day` | Anchor event. |
| Tue Jun 16, 09:05-20:00 CEST | Waitlist email | `vercel-day-live` cron window | Send only if `PRODUCT_HUNT_LAUNCH_URL` is set. |
| Tue Jun 16, 09:10 CEST | X + LinkedIn | Typefully cron plan `2026-06-16-live-now-*` | Direct people to Product Hunt for feedback/comments. |
| Tue Jun 16, 17:00 CEST | X | Typefully cron plan `2026-06-16-midday-feedback-x` | Ask for specific feedback from people who tried the page/product. |
| Wed Jun 17, 10:30 CEST | Waitlist email | `vercel-day-recap` cron window | Follow-up and collect deeper feedback. |
| Wed Jun 17, 11:00 CEST | X + LinkedIn | Typefully cron plan `2026-06-17-recap-*` | Share learnings, not bragging. |

## Required Environment

Set these in the API Vercel project before launch:

```bash
CRON_SECRET=<already used by cron>
PRODUCT_HUNT_LAUNCH_URL=https://www.producthunt.com/posts/<slug>
NEXT_PUBLIC_PRODUCT_HUNT_LAUNCH_URL=https://www.producthunt.com/posts/<slug>
PRODUCT_HUNT_LAUNCH_AUTOMATION_ENABLED=true
PRODUCT_HUNT_LAUNCH_EMAIL_BATCH_SIZE=50
PRODUCT_HUNT_SOCIAL_AUTOMATION_ENABLED=true
PRODUCT_HUNT_SOCIAL_ATTACH_MEDIA=true
```

If `PRODUCT_HUNT_LAUNCH_URL` is missing, the live and recap emails intentionally skip instead of sending a placeholder Product Hunt link.
The same is true for Typefully social posts that link to the live Product Hunt page.
