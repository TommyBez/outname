import {
  PRODUCT_HUNT_LAUNCH,
  productHuntFaq,
  productHuntStackHighlights,
} from '@outname/shared/launch/product-hunt'
import { githubRepositoryUrl } from '@outname/shared/marketing/data/social-links'
import { siteConfig } from '@outname/shared/server/site-metadata'

export function buildProductHuntJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: siteConfig.name,
        url: siteConfig.url,
        sameAs: [githubRepositoryUrl],
      },
      {
        '@type': 'SoftwareApplication',
        applicationCategory: 'ProductivityApplication',
        description: siteConfig.description,
        name: siteConfig.name,
        operatingSystem: 'Web',
        url: `${siteConfig.url}/product-hunt`,
        featureList: [
          'Personal AI agents',
          'Scheduled autonomous runs',
          'Readable memory',
          'Tool attachments',
          'Sub-agents',
          'Sandboxed execution',
          ...productHuntStackHighlights.map((item) => item.label),
        ],
        offers: {
          '@type': 'Offer',
          availability: 'https://schema.org/PreOrder',
          price: '0',
          priceCurrency: 'USD',
        },
      },
      {
        '@type': 'Event',
        eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
        eventStatus: 'https://schema.org/EventScheduled',
        name: PRODUCT_HUNT_LAUNCH.title,
        startDate: PRODUCT_HUNT_LAUNCH.launchStartIso,
        endDate: PRODUCT_HUNT_LAUNCH.launchEndIso,
        location: {
          '@type': 'VirtualLocation',
          url: 'https://www.producthunt.com/',
        },
        organizer: {
          '@type': 'Organization',
          name: siteConfig.name,
          url: siteConfig.url,
        },
      },
      {
        '@type': 'FAQPage',
        mainEntity: productHuntFaq.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      },
    ],
  }
}
