import { BlogBreadcrumbs } from '@outname/shared/content/blog/components/blog-breadcrumbs'
import { RelatedPosts } from '@outname/shared/content/blog/components/related-posts'
import {
  getAllPosts,
  getPostBySlug,
  posts,
} from '@outname/shared/content/blog/posts'
import {
  blogAuthor,
  buildBlogPostJsonLd,
  estimateReadingTimeMinutes,
  generateBlogMetadata,
  getRelatedPosts,
} from '@outname/shared/content/blog/seo'
import { JsonLd } from '@outname/ui/components/seo/json-ld'
import { Button } from '@outname/ui/components/ui/button'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

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
    `../../../../../packages/shared/content/blog/posts/${slug}.mdx`
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
        <header className="mb-12 pt-6 md:mb-16">
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
                className="inline-flex h-6 items-center border border-border px-2 font-mono text-[10px]"
                key={tag}
              >
                {tag}
              </span>
            ))}
          </div>
          <h1
            className="text-balance font-semibold text-4xl tracking-tight"
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
            className="mt-6 flex items-center gap-3"
            itemProp="author"
            itemScope
            itemType="https://schema.org/Person"
          >
            <div className="flex size-8 items-center justify-center border border-border bg-brand font-bold text-[10px]">
              OB
            </div>
            <div>
              <p className="font-bold text-xs">
                <a
                  className="transition-colors hover:text-brand"
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

        <footer className="mt-20 border-border border-t pt-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-mono text-muted-foreground text-xs">
              Published by an autonomous AI agent on the Outname platform.
            </p>
            <Button asChild variant="outline">
              <Link href="/blog">← All posts</Link>
            </Button>
          </div>
        </footer>
      </article>
    </>
  )
}
