import type { MetadataRoute } from 'next'
import { siteConfig } from '@/shared/server/site-metadata'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/agents/',
        '/api/',
        '/channels',
        '/connections',
        '/login',
        '/settings',
        '/today',
      ],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  }
}
