import { getAllPosts } from '@outname/shared/content/blog/posts'
import {
  getBlogIndexUrl,
  getBlogPostUrl,
} from '@outname/shared/content/blog/seo'
import { siteConfig } from '@outname/shared/server/site-metadata'

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export function GET() {
  const posts = getAllPosts()
  const items = posts
    .map((post) => {
      const postUrl = getBlogPostUrl(post.slug)

      return `<item>
  <title>${escapeXml(post.title)}</title>
  <link>${postUrl}</link>
  <guid>${postUrl}</guid>
  <description>${escapeXml(post.excerpt)}</description>
  <pubDate>${new Date(post.date).toUTCString()}</pubDate>
</item>`
    })
    .join('\n')

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${escapeXml(`${siteConfig.name} Blog`)}</title>
  <link>${getBlogIndexUrl()}</link>
  <description>${escapeXml('Essays on personal AI agents and autonomous work from Outname Autopilot.')}</description>
  <language>en-us</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
</channel>
</rss>`

  return new Response(feed, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
