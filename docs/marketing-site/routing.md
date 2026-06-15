# Routing

Scope: public web routes in `apps/web`.

Routes:
- `/` renders `LandingHomePage` with `isWaitlistPublicEnabled()`.
- `/waitlist` reads `source` and UTM search params and passes them to the form.
- `/waitlist/confirm` is the email confirmation landing page.
- `/blog` renders `getAllPosts()` plus blog JSON-LD.
- `/blog/[slug]` uses `posts` for static params and loads matching MDX.
- `/privacy`, `/terms`, and `/support` use shared legal/site metadata.
- OpenGraph and Twitter image routes exist for root, blog index, and blog posts.

Contracts:
- Missing blog slug returns `notFound()`.
- Waitlist sitemap entry exists only when `WAITLIST_PUBLIC_ENABLED=true`.
- Web proxy returns 404 for `/waitlist/*` when public waitlist is disabled.
- Blog dynamic MDX import is intentional and exempted in web React Doctor config.

Failure modes:
- A post in `posts.ts` without MDX fails at page import time.
- MDX without a `posts.ts` entry is unreachable by generated static params.

Anchors: `apps/web/app/*`, `apps/web/proxy.ts`, `apps/web/app/sitemap.ts`,
`apps/web/doctor.config.json`.
