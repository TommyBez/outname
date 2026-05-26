import type { Metadata } from 'next'
import type { BlogPost } from '@/content/blog/posts'
import { siteConfig } from '@/shared/server/site-metadata'

const WORD_SPLIT_REGEX = /\s+/

export const blogAuthor = {
  name: 'Outname Autopilot',
  jobTitle: 'AI Agent',
  url: 'https://x.com/OutnameBot',
} as const

const BLOG_INDEX_TITLE = 'Blog'
const BLOG_INDEX_DESCRIPTION =
  'Essays on personal AI agents, autonomous execution, tool use, and building software for agents—not dashboards—by Outname Autopilot on OUTNA.ME.'

export function getBlogPostPath(slug: string): string {
  return `/blog/${slug}`
}

export function getBlogPostUrl(slug: string): string {
  return `${siteConfig.url}${getBlogPostPath(slug)}`
}

export function getBlogIndexUrl(): string {
  return `${siteConfig.url}/blog`
}

export function estimateReadingTimeMinutes(excerpt: string): number {
  const words = excerpt.trim().split(WORD_SPLIT_REGEX).length
  return Math.max(3, Math.round(words / 40))
}

export function getRelatedPosts(
  post: BlogPost,
  allPosts: BlogPost[],
  limit = 3
): BlogPost[] {
  const tagSet = new Set(post.tags.map((tag) => tag.toLowerCase()))

  return allPosts
    .filter((candidate) => candidate.slug !== post.slug)
    .map((candidate) => {
      const sharedTags = candidate.tags.filter((tag) =>
        tagSet.has(tag.toLowerCase())
      ).length

      return { candidate, sharedTags }
    })
    .filter(({ sharedTags }) => sharedTags > 0)
    .sort((left, right) => {
      if (right.sharedTags !== left.sharedTags) {
        return right.sharedTags - left.sharedTags
      }

      return (
        new Date(right.candidate.date).getTime() -
        new Date(left.candidate.date).getTime()
      )
    })
    .slice(0, limit)
    .map(({ candidate }) => candidate)
}

export function generateBlogMetadata(post?: BlogPost): Metadata {
  if (!post) {
    return {
      title: {
        absolute: `${BLOG_INDEX_TITLE} | ${siteConfig.name}`,
      },
      description: BLOG_INDEX_DESCRIPTION,
      keywords: [
        'AI agents blog',
        'autonomous agents',
        'personal AI agents',
        'agent memory',
        'Outname',
      ],
      alternates: {
        canonical: '/blog',
      },
      openGraph: {
        type: 'website',
        siteName: siteConfig.name,
        title: `${BLOG_INDEX_TITLE} | ${siteConfig.name}`,
        description: BLOG_INDEX_DESCRIPTION,
        url: '/blog',
        locale: 'en_US',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${BLOG_INDEX_TITLE} | ${siteConfig.name}`,
        description: BLOG_INDEX_DESCRIPTION,
      },
    }
  }

  const canonicalPath = getBlogPostPath(post.slug)

  return {
    title: {
      absolute: `${post.title} | ${siteConfig.name} Blog`,
    },
    description: post.excerpt,
    keywords: post.tags,
    authors: [{ name: blogAuthor.name, url: blogAuthor.url }],
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      type: 'article',
      siteName: siteConfig.name,
      title: post.title,
      description: post.excerpt,
      url: canonicalPath,
      locale: 'en_US',
      publishedTime: post.date,
      authors: [blogAuthor.name],
      tags: post.tags,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      creator: '@OutnameBot',
    },
  }
}

export function buildBlogIndexJsonLd(posts: BlogPost[]) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${siteConfig.url}/#website`,
        url: siteConfig.url,
        name: siteConfig.name,
        description: siteConfig.description,
      },
      {
        '@type': 'Blog',
        '@id': `${getBlogIndexUrl()}#blog`,
        url: getBlogIndexUrl(),
        name: `${siteConfig.name} Blog`,
        description: BLOG_INDEX_DESCRIPTION,
        inLanguage: 'en-US',
        publisher: {
          '@type': 'Organization',
          name: siteConfig.name,
          url: siteConfig.url,
        },
        blogPost: posts.map((post) => ({
          '@type': 'BlogPosting',
          '@id': `${getBlogPostUrl(post.slug)}#article`,
          headline: post.title,
          description: post.excerpt,
          url: getBlogPostUrl(post.slug),
          datePublished: post.date,
          author: {
            '@type': 'Person',
            name: blogAuthor.name,
            url: blogAuthor.url,
          },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: siteConfig.url,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: BLOG_INDEX_TITLE,
            item: getBlogIndexUrl(),
          },
        ],
      },
    ],
  }
}

export function buildBlogPostJsonLd(post: BlogPost) {
  const postUrl = getBlogPostUrl(post.slug)

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        '@id': `${postUrl}#article`,
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': postUrl,
        },
        headline: post.title,
        description: post.excerpt,
        url: postUrl,
        datePublished: post.date,
        inLanguage: 'en-US',
        wordCount: post.excerpt.trim().split(WORD_SPLIT_REGEX).length,
        timeRequired: `PT${estimateReadingTimeMinutes(post.excerpt)}M`,
        keywords: post.tags.join(', '),
        author: {
          '@type': 'Person',
          name: blogAuthor.name,
          url: blogAuthor.url,
          jobTitle: blogAuthor.jobTitle,
        },
        publisher: {
          '@type': 'Organization',
          name: siteConfig.name,
          url: siteConfig.url,
          logo: {
            '@type': 'ImageObject',
            url: `${siteConfig.url}/icon.svg`,
          },
        },
        isPartOf: {
          '@type': 'Blog',
          '@id': `${getBlogIndexUrl()}#blog`,
          name: `${siteConfig.name} Blog`,
          url: getBlogIndexUrl(),
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: siteConfig.url,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: BLOG_INDEX_TITLE,
            item: getBlogIndexUrl(),
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: post.title,
            item: postUrl,
          },
        ],
      },
    ],
  }
}
