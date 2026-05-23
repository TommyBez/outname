import { notFound } from 'next/navigation'
import { getPostBySlug, posts } from '@/content/blog/posts'
import { createBlogSocialImageResponse } from '@/shared/components/social/blog-social-image'
import { socialImageSize } from '@/shared/components/social/social-image'

interface BlogPostTwitterImageProps {
  params: Promise<{ slug: string }>
}

export const size = socialImageSize

export const contentType = 'image/png'

export function generateStaticParams() {
  return posts.map((post) => ({ slug: post.slug }))
}

export async function generateImageMetadata({
  params,
}: BlogPostTwitterImageProps) {
  const { slug } = await params
  const post = getPostBySlug(slug)

  if (!post) {
    return []
  }

  return [
    {
      alt: `${post.title} — OUTNA.ME Blog`,
      contentType: 'image/png',
      size: socialImageSize,
    },
  ]
}

export default async function Image({ params }: BlogPostTwitterImageProps) {
  const { slug } = await params
  const post = getPostBySlug(slug)

  if (!post) {
    notFound()
  }

  return createBlogSocialImageResponse({
    kind: 'post',
    title: post.title,
    description: post.excerpt,
    date: post.date,
    tags: post.tags,
  })
}
