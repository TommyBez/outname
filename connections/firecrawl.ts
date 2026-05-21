import 'server-only'
import { z } from 'zod'
import { defineConnector } from './define-connector'

const FIRECRAWL_MAX_RESPONSE_BYTES = 256 * 1024

const firecrawlCredentialSchema = z.object({
  apiKey: z.string().min(1, 'Required'),
})

export type FirecrawlCredential = z.infer<typeof firecrawlCredentialSchema>

export const firecrawlConnector = defineConnector('firecrawl.api_key', {
  displayName: 'Firecrawl API',
  description:
    'Scrape, crawl, and extract web content via Firecrawl API endpoints.',
  credential: firecrawlCredentialSchema,
  fields: [
    {
      name: 'apiKey',
      label: 'API key',
      type: 'password',
      placeholder: 'Paste your Firecrawl API key',
      description:
        'Generate in Firecrawl dashboard. It is encrypted at rest before storage.',
    },
  ],
  broker: {
    allowedHosts: ['api.firecrawl.dev'] as const,
    injectedHeaderNames: ['authorization'] as const,
    injectedHeaders: (credential: FirecrawlCredential) => ({
      authorization: `Bearer ${credential.apiKey}`,
    }),
    maxResponseBytes: FIRECRAWL_MAX_RESPONSE_BYTES,
  },
})
