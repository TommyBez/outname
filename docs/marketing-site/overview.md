# Marketing Site

Mini-spec for the public website in `apps/web`.

Surface:
- Home renders `LandingHomePage` with shared waitlist config.
- Root layout owns metadata, fonts, tooltips, toasts, and production analytics.
- Navigation links to Blog, Login, GitHub, and conditionally Waitlist.
- Waitlist preserves `source` and UTM params into `WaitlistSignupForm`.
- Blog index/post pages read static data from `packages/shared/content/blog`.

Flow:
- `/` delegates composition to `packages/shared/marketing`.
- `/blog` calls `getAllPosts()`, renders JSON-LD, and lists posts.
- `/blog/[slug]` uses `posts` for static params and imports matching MDX.
- Missing blog slugs return `notFound()`.
- `sitemap.ts` adds `/waitlist` only when `WAITLIST_PUBLIC_ENABLED === 'true'`.

States:
- `waitlistEnabled=false`: hide waitlist CTA/nav/sitemap entry, keep login CTAs.
- `posts.length=0`: show the empty blog state.
- Reduced motion disables landing text-loop/reveal triggers.

Invariants:
- A blog post needs metadata in `posts.ts` and MDX at `posts/<slug>.mdx`.
- Blog SEO, related posts, JSON-LD, reading time, and cards derive from post data.
- Marketing claims/data live in shared packages; `apps/web` stays routing glue.
