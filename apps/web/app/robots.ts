import { siteConfig } from '@outname/shared/server/site-metadata'
import type { MetadataRoute } from 'next'

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
