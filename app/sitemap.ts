import type { MetadataRoute } from 'next'
import { siteConfig } from '@/shared/server/site-metadata'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteConfig.url,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ]
}
