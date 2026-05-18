import type { MetadataRoute } from 'next'
import { siteConfig } from '@/shared/server/site-metadata'

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [
    {
      url: siteConfig.url,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ]

  if (process.env.WAITLIST_PUBLIC_ENABLED === 'true') {
    entries.push({
      url: `${siteConfig.url}/waitlist`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    })
  }

  return entries
}
