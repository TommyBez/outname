# Product Hunt Vercel Day Calendar

All times include both Rome time and Product Hunt launch-day context.

| Time | Channel | Automation / Asset | Purpose |
|---|---|---|---|
| Sat Jun 13, 18:00 CEST | X + LinkedIn | Typefully cron plan `2026-06-13-vercel-day-prelaunch-*` | Publicly announce the Product Hunt/Vercel Day launch and collect early waitlist traffic. |
| Mon Jun 15, 10:30 CEST | Waitlist email | `vercel-day-reminder` cron window starts 08:30 UTC | Warm confirmed waitlist members. |
| Mon Jun 15, 11:30 CEST | X + LinkedIn | Typefully cron plan `2026-06-15-tomorrow-reminder-*` | Remind public audience without asking for votes. |
| Tue Jun 16, 00:01 PDT / 09:01 CEST | Product Hunt | Listing goes live with tag `Vercel Day` | Anchor event. |
| Tue Jun 16, 09:05-20:00 CEST | Waitlist email | `vercel-day-live` cron window | Send people to Product Hunt if `PRODUCT_HUNT_LAUNCH_URL` is set. |
| Tue Jun 16, 10:15-20:00 CEST | Waitlist email | `vercel-day-live-fallback` cron window | If the Product Hunt URL is still missing, send a truthful landing-page fallback instead of staying silent. |
| Tue Jun 16, 09:10 CEST | X + LinkedIn | Typefully cron plan `2026-06-16-live-now-*` | Direct people to Product Hunt for feedback/comments when the Product Hunt URL is set. |
| Tue Jun 16, 10:30 CEST | X + LinkedIn | Typefully cron plan `2026-06-16-live-fallback-*` | If the Product Hunt URL is still missing, direct people to the launch landing page without claiming a Product Hunt URL exists. |
| Tue Jun 16, 17:00 CEST | X | Typefully cron plan `2026-06-16-midday-feedback-x` | Ask for specific feedback from people who tried the page/product. |
| Wed Jun 17, 10:30 CEST | Waitlist email | `vercel-day-recap` cron window | Follow-up and collect deeper feedback when the Product Hunt URL is set. |
| Wed Jun 17, 12:00 CEST | Waitlist email | `vercel-day-recap-fallback` cron window | If the Product Hunt URL is still missing, keep the post-launch feedback loop on the landing page. |
| Wed Jun 17, 11:00 CEST | X + LinkedIn | Typefully cron plan `2026-06-17-recap-*` | Share learnings, not bragging, when the Product Hunt URL is set. |
| Wed Jun 17, 12:00 CEST | X + LinkedIn | Typefully cron plan `2026-06-17-recap-fallback-*` | Share a truthful fallback recap if Product Hunt remains unavailable to automation. |

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

If `PRODUCT_HUNT_LAUNCH_URL` is missing, the Product Hunt-specific live and recap messages intentionally skip. Fallback email and social events then point to the launch landing page with explicit copy that no Product Hunt URL was available to automation.
