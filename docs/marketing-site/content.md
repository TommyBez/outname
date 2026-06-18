# Content

Scope: shared marketing copy, blog metadata, and landing page composition.

Landing:
- `LandingHomePage` composes nav, hero demo, chat showcase, workbench, closer, footer.
- `waitlistEnabled` controls public waitlist CTAs in nav and closer.
- `useReducedMotion()` disables motion-heavy landing behavior for users who opt out.
- Marketing modules read demo data from `packages/shared/marketing/data`.

Blog:
- `posts` is the canonical list of slug, title, date, excerpt, and tags.
- `getAllPosts()` sorts newest first by date.
- `getRelatedPosts()` scores posts by shared lowercase tags, then newer date.
- SEO metadata, JSON-LD, reading time, and breadcrumbs derive from post data.
- MDX bodies live under `packages/shared/content/blog/posts`.

Invariants:
- Add a blog post by updating `posts.ts` and adding matching `<slug>.mdx`.
- Keep waitlist attribution params flowing through links and the waitlist form.
- Keep product claims in shared content/data, not hard-coded in route wrappers.

Anchors: `packages/shared/marketing/components/landing-home-page.tsx`,
`packages/shared/content/blog/posts.ts`, `packages/shared/content/blog/seo.ts`.
