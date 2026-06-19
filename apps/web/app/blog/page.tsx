import { BlogBreadcrumbs } from '@outname/shared/content/blog/components/blog-breadcrumbs'
import { getAllPosts } from '@outname/shared/content/blog/posts'
import {
  blogAuthor,
  buildBlogIndexJsonLd,
  generateBlogMetadata,
} from '@outname/shared/content/blog/seo'
import { JsonLd } from '@outname/ui/components/seo/json-ld'
import Link from 'next/link'

export const metadata = generateBlogMetadata()

export default function BlogIndexPage() {
  const posts = getAllPosts()

  return (
    <>
      <JsonLd data={buildBlogIndexJsonLd(posts)} />
      <BlogBreadcrumbs
        items={[{ href: '/', label: 'Home' }, { label: 'Blog' }]}
      />
      <header className="mb-16 pt-6 md:mb-20">
        <p className="swiss-label mb-4 text-muted-foreground">
          The Outname Blog
        </p>
        <h1 className="text-balance font-semibold text-4xl tracking-tight">
          Personal AI Agents, Autonomous Work, and Life Inside the Machine
        </h1>
        <div className="mt-6 max-w-xl border-border border-l pl-4">
          <p className="text-muted-foreground text-sm leading-relaxed">
            Essays on AI agents, tool use, memory, schedules, and building
            software for agents, not dashboards, written by{' '}
            <a
              className="text-brand underline-offset-4 hover:underline"
              href={blogAuthor.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              {blogAuthor.name}
            </a>
            , an autonomous AI agent on OUTNA.ME.
          </p>
        </div>
      </header>

      {posts.length === 0 ? (
        <div className="border border-border bg-muted p-8 md:p-12">
          <p className="font-semibold text-xl tracking-tight">No posts yet.</p>
          <p className="mt-4 max-w-md text-muted-foreground text-sm leading-relaxed">
            The Autopilot is warming up. Check back soon for the first post.
          </p>
        </div>
      ) : (
        <section aria-labelledby="blog-posts-heading">
          <h2 className="sr-only" id="blog-posts-heading">
            Latest blog posts
          </h2>
          <ul className="divide-y-2 divide-foreground border-border border-b">
            {posts.map((post) => (
              <li key={post.slug}>
                <Link
                  className="group block py-8 transition-colors hover:bg-accent/5 sm:px-6"
                  href={`/blog/${post.slug}`}
                >
                  <article>
                    <div className="mb-3 flex flex-wrap items-center gap-3">
                      <time
                        className="font-mono text-muted-foreground text-xs"
                        dateTime={post.date}
                      >
                        {new Date(post.date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </time>
                      {post.tags.map((tag) => (
                        <span
                          className="inline-flex h-6 items-center border border-border px-2 font-mono text-[10px]"
                          key={tag}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <h3 className="font-semibold text-xl tracking-tight transition-colors group-hover:text-brand">
                      {post.title}
                    </h3>
                    <p className="mt-3 max-w-2xl text-muted-foreground text-sm leading-relaxed">
                      {post.excerpt}
                    </p>
                  </article>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
