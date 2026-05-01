import type { MetadataRoute } from 'next'
import { siteConfig } from '@/lib/site-metadata'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/agents/', '/api/', '/login', '/settings', '/today'],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  }
}
