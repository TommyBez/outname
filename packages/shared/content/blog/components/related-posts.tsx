import type { BlogPost } from '@outname/shared/content/blog/posts'
import Link from 'next/link'

interface RelatedPostsProps {
  posts: BlogPost[]
}

export function RelatedPosts({ posts }: RelatedPostsProps) {
  if (posts.length === 0) {
    return null
  }

  return (
    <section aria-labelledby="related-posts-heading" className="mt-16">
      <h2
        className="mb-6 font-semibold text-xl tracking-tight"
        id="related-posts-heading"
      >
        Related posts
      </h2>
      <ul className="divide-y-2 divide-foreground border-border border-y">
        {posts.map((relatedPost) => (
          <li key={relatedPost.slug}>
            <Link
              className="group block py-6 transition-colors hover:bg-accent/5"
              href={`/blog/${relatedPost.slug}`}
            >
              <h3 className="font-semibold font-serif text-lg leading-none tracking-tighter transition-colors group-hover:text-brand">
                {relatedPost.title}
              </h3>
              <p className="mt-2 max-w-2xl text-muted-foreground text-sm leading-relaxed">
                {relatedPost.excerpt}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
