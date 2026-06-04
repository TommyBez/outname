import { getPostBySlug, posts } from '@outname/shared/content/blog/posts'
import { createBlogSocialImageResponse } from '@outname/ui/components/social/blog-social-image'
import { socialImageSize } from '@outname/ui/components/social/social-image'
import { notFound } from 'next/navigation'

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
      id: 'default',
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
