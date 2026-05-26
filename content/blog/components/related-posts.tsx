import Link from 'next/link'
import type { BlogPost } from '@/content/blog/posts'

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
        className="mb-6 font-black font-serif text-xl uppercase tracking-tighter"
        id="related-posts-heading"
      >
        Related posts
      </h2>
      <ul className="divide-y-2 divide-foreground border-foreground border-y-2">
        {posts.map((relatedPost) => (
          <li key={relatedPost.slug}>
            <Link
              className="group block py-6 transition-colors hover:bg-accent/5"
              href={`/blog/${relatedPost.slug}`}
            >
              <h3 className="font-black font-serif text-lg uppercase leading-none tracking-tighter transition-colors group-hover:text-accent">
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
