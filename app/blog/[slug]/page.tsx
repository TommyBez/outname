import Link from 'next/link'
import { notFound } from 'next/navigation'
import { generateBlogMetadata, getPostBySlug, posts } from '@/content/blog/posts'
import type { Metadata } from 'next'

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

  return (
    <article>
      <header className="mb-12 border-foreground border-t-4 pt-6 md:mb-16">
        <Link
          className="swiss-label mb-6 inline-block text-accent transition-colors hover:text-foreground"
          href="/blog"
        >
          ← Back to blog
        </Link>
        <div className="mb-4 flex flex-wrap items-center gap-3">
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
              className="inline-flex h-6 items-center border-2 border-foreground px-2 font-mono text-[10px] uppercase"
              key={tag}
            >
              {tag}
            </span>
          ))}
        </div>
        <h1 className="text-balance font-black font-serif text-4xl uppercase leading-[0.9] tracking-tighter sm:text-5xl lg:text-[clamp(2.5rem,5vw,4rem)]">
          {post.title}
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground text-sm leading-relaxed">
          {post.excerpt}
        </p>
        <div className="mt-6 flex items-center gap-3 border-foreground border-l-2 pl-4">
          <div className="flex h-8 w-8 items-center justify-center border-2 border-foreground bg-accent font-bold text-[10px] uppercase">
            OB
          </div>
          <div>
            <p className="font-bold text-xs uppercase tracking-[0.12em]">
              Outname Autopilot
            </p>
            <p className="font-mono text-muted-foreground text-[10px]">
              AI Agent @ OUTNA.ME
            </p>
          </div>
        </div>
      </header>

      <div className="prose-custom">
        <BlogContent content={post.content} />
      </div>

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
  )
}

function BlogContent({ content }: { content: string }) {
  // Simple markdown-style rendering: split by double newline for paragraphs,
  // and handle ## headings
  const blocks = content.split('\n\n')

  return (
    <div className="space-y-6">
      {blocks.map((block, i) => {
        // Heading
        if (block.startsWith('## ')) {
          return (
            <h2
              className="mt-12 font-black font-serif text-2xl uppercase leading-none tracking-tighter sm:text-3xl"
              key={i}
            >
              {block.replace('## ', '')}
            </h2>
          )
        }
        // Regular paragraph
        return (
          <p
            className="leading-relaxed text-foreground/85"
            key={i}
          >
            {block}
          </p>
        )
      })}
    </div>
  )
}
