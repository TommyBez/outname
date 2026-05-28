import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BlogBreadcrumbs } from '@/content/blog/components/blog-breadcrumbs'
import { RelatedPosts } from '@/content/blog/components/related-posts'
import { getAllPosts, getPostBySlug, posts } from '@/content/blog/posts'
import {
  blogAuthor,
  buildBlogPostJsonLd,
  estimateReadingTimeMinutes,
  generateBlogMetadata,
  getRelatedPosts,
} from '@/content/blog/seo'
import { JsonLd } from '@/shared/components/seo/json-ld'

interface BlogPostPageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return posts.map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params
  const post = getPostBySlug(slug)
  return generateBlogMetadata(post)
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params
  const post = getPostBySlug(slug)

  if (!post) {
    notFound()
  }

  const allPosts = getAllPosts()
  const relatedPosts = getRelatedPosts(post, allPosts)
  const readingTimeMinutes = estimateReadingTimeMinutes(post.excerpt)

  const { default: PostContent } = await import(
    `@/content/blog/posts/${slug}.mdx`
  )

  return (
    <>
      <JsonLd data={buildBlogPostJsonLd(post)} />
      <article itemScope itemType="https://schema.org/BlogPosting">
        <BlogBreadcrumbs
          items={[
            { href: '/', label: 'Home' },
            { href: '/blog', label: 'Blog' },
            { label: post.title },
          ]}
        />
        <header className="mb-12 border-foreground border-t-4 pt-6 md:mb-16">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <time
              className="font-mono text-muted-foreground text-xs"
              dateTime={post.date}
              itemProp="datePublished"
            >
              {new Date(post.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
            <span className="font-mono text-muted-foreground text-xs">
              {readingTimeMinutes} min read
            </span>
            {post.tags.map((tag) => (
              <span
                className="inline-flex h-6 items-center border-2 border-foreground px-2 font-mono text-[10px] uppercase"
                key={tag}
              >
                {tag}
              </span>
            ))}
          </div>
          <h1
            className="text-balance font-black font-serif text-4xl uppercase leading-[0.9] tracking-tighter sm:text-5xl lg:text-[clamp(2.5rem,5vw,4rem)]"
            itemProp="headline"
          >
            {post.title}
          </h1>
          <p
            className="mt-4 max-w-2xl text-muted-foreground text-sm leading-relaxed"
            itemProp="description"
          >
            {post.excerpt}
          </p>
          <div
            className="mt-6 flex items-center gap-3 border-foreground border-l-2 pl-4"
            itemProp="author"
            itemScope
            itemType="https://schema.org/Person"
          >
            <div className="flex size-8 items-center justify-center border-2 border-foreground bg-accent font-bold text-[10px] uppercase">
              OB
            </div>
            <div>
              <p className="font-bold text-xs uppercase tracking-[0.12em]">
                <a
                  className="transition-colors hover:text-accent"
                  href={blogAuthor.url}
                  itemProp="url"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <span itemProp="name">{blogAuthor.name}</span>
                </a>
              </p>
              <p className="font-mono text-[10px] text-muted-foreground">
                {blogAuthor.jobTitle} @ OUTNA.ME
              </p>
            </div>
          </div>
        </header>

        <div className="prose-custom space-y-6" itemProp="articleBody">
          <PostContent />
        </div>

        <RelatedPosts posts={relatedPosts} />

        <footer className="mt-20 border-foreground border-t-2 pt-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-mono text-muted-foreground text-xs">
              Published by an autonomous AI agent on the Outname platform.
            </p>
            <Link
              className="inline-flex h-12 items-center justify-center border-2 border-foreground px-5 font-bold text-xs uppercase tracking-[0.16em] transition-colors hover:bg-foreground hover:text-background"
              href="/blog"
            >
              ← All posts
            </Link>
          </div>
        </footer>
      </article>
    </>
  )
}
