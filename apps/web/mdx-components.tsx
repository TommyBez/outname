import type { MDXComponents } from 'mdx/types'
import Link from 'next/link'
import type { ComponentPropsWithoutRef } from 'react'

function MdxLink({ href, children, ...props }: ComponentPropsWithoutRef<'a'>) {
  if (href?.startsWith('/')) {
    return (
      <Link
        className="text-accent underline-offset-4 hover:underline"
        href={href}
        {...props}
      >
        {children}
      </Link>
    )
  }

  if (href?.startsWith('http')) {
    return (
      <a
        {...props}
        className="text-accent underline-offset-4 hover:underline"
        href={href}
        rel="noreferrer"
        target="_blank"
      >
        {children}
      </a>
    )
  }

  return (
    <a
      {...props}
      className="text-accent underline-offset-4 hover:underline"
      href={href}
    >
      {children}
    </a>
  )
}

const components = {
  h1: ({ children }) => (
    <h2 className="mt-12 font-black font-serif text-2xl uppercase leading-none tracking-tighter sm:text-3xl">
      {children}
    </h2>
  ),
  h2: ({ children }) => (
    <h2 className="mt-12 font-black font-serif text-2xl uppercase leading-none tracking-tighter sm:text-3xl">
      {children}
    </h2>
  ),
  p: ({ children }) => (
    <p className="text-foreground/85 leading-relaxed">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc space-y-2 pl-6 text-foreground/85 leading-relaxed">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal space-y-2 pl-6 text-foreground/85 leading-relaxed">
      {children}
    </ol>
  ),
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => (
    <strong className="font-bold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  hr: () => <hr className="my-10 border-foreground border-t-2" />,
  a: MdxLink,
} satisfies MDXComponents

export function useMDXComponents(): MDXComponents {
  return components
}
