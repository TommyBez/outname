import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import {
  generateBlogMetadata,
  getPostBySlug,
  posts,
} from '@/content/blog/posts'

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

const markdownComponents: Partial<Components> = {
  h2: ({ children, ...props }) => (
    <h2
      className="mt-12 font-black font-serif text-2xl uppercase leading-none tracking-tighter sm:text-3xl"
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3
      className="mt-8 font-bold font-serif text-xl uppercase leading-tight tracking-tight"
      {...props}
    >
      {children}
    </h3>
  ),
  p: ({ children, ...props }) => (
    <p className="text-foreground/85 leading-relaxed" {...props}>
      {children}
    </p>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-bold text-foreground" {...props}>
      {children}
    </strong>
  ),
  em: ({ children, ...props }) => (
    <em className="italic" {...props}>
      {children}
    </em>
  ),
  a: ({ children, href, ...props }) => (
    <a
      className="border-accent border-b-2 text-foreground transition-colors hover:border-foreground hover:text-accent"
      href={href}
      {...props}
    >
      {children}
    </a>
  ),
  code: ({ children, className, ...props }) => {
    const isInline = !className
    if (isInline) {
      return (
        <code
          className="border-foreground/20 border bg-foreground/5 px-1.5 py-0.5 font-mono text-[0.85em] text-accent"
          {...props}
        >
          {children}
        </code>
      )
    }
    return (
      <code
        className="block overflow-x-auto border-foreground/20 border bg-foreground/5 p-4 font-mono text-[0.85em]"
        {...props}
      >
        {children}
      </code>
    )
  },
  pre: ({ children, ...props }) => (
    <pre
      className="my-6 overflow-x-auto border-2 border-foreground bg-foreground/5 p-4 font-mono text-[0.85em] leading-relaxed"
      {...props}
    >
      {children}
    </pre>
  ),
  ul: ({ children, ...props }) => (
    <ul className="my-4 list-inside list-disc space-y-1 pl-4" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="my-4 list-inside list-decimal space-y-1 pl-4" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="text-foreground/85 leading-relaxed" {...props}>
      {children}
    </li>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="my-6 border-accent border-l-4 bg-foreground/5 py-2 pl-4 italic text-foreground/80"
      {...props}
    >
      {children}
    </blockquote>
  ),
  hr: (props) => (
    <hr className="my-10 border-foreground border-t-2" {...props} />
  ),
  img: ({ src, alt, ...props }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="my-8 w-full border-2 border-foreground"
      src={src}
      alt={alt ?? ''}
      {...props}
    />
  ),
  table: ({ children, ...props }) => (
    <div className="my-6 overflow-x-auto border-2 border-foreground">
      <table className="w-full border-collapse font-mono text-xs" {...props}>
        {children}
      </table>
    </div>
  ),
  th: ({ children, ...props }) => (
    <th
      className="border-foreground border bg-foreground/10 p-3 text-left font-bold uppercase tracking-wider"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="border-foreground border p-3" {...props}>
      {children}
    </td>
  ),
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
            <p className="font-mono text-[10px] text-muted-foreground">
              AI Agent @ OUTNA.ME
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-6">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {post.content}
        </ReactMarkdown>
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
