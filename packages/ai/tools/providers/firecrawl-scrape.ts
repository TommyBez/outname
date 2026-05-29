import 'server-only'
import {
  defineApiPassthroughTool,
  toolError,
  toolSuccess,
} from '@outname/ai/tools/runtime/define-maintainer-tool'
import {
  parseProviderResponseFromHttp,
  toolErrorFromProviderResponse,
} from '@outname/ai/tools/runtime/define-maintainer-tool/provider-response'
import { z } from 'zod'

const FIRECRAWL_API_BASE = 'https://api.firecrawl.dev'

const firecrawlScrapeInputSchema = z.object({
  url: z.url().describe('The page URL to scrape.'),
  formats: z
    .array(z.string())
    .min(1)
    .default(['markdown'])
    .describe(
      'Output formats such as markdown, html, rawHtml, links, screenshot, or json.'
    ),
  onlyMainContent: z
    .boolean()
    .default(true)
    .describe(
      'When true, returns main page content and excludes navigation/chrome where possible.'
    ),
  waitFor: z
    .number()
    .int()
    .min(0)
    .max(120_000)
    .optional()
    .describe(
      'Optional delay in milliseconds before capture for dynamic pages.'
    ),
  timeout: z
    .number()
    .int()
    .min(1000)
    .max(180_000)
    .optional()
    .describe('Optional scrape timeout in milliseconds.'),
  mobile: z
    .boolean()
    .optional()
    .describe('Set true to emulate a mobile viewport during scrape.'),
  includeTags: z
    .array(z.string())
    .optional()
    .describe('Optional HTML tags to include in extraction.'),
  excludeTags: z
    .array(z.string())
    .optional()
    .describe('Optional HTML tags to exclude in extraction.'),
  maxAge: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Optional cache max age in milliseconds.'),
})

export const firecrawlScrapeTool = defineApiPassthroughTool({
  id: 'firecrawl_scrape',
  category: 'browser',
  displayName: 'Firecrawl · Scrape',
  displayDescription: 'Extract readable content from a web page URL.',
  description:
    'Scrape a single URL using Firecrawl Scrape API (v2) and return structured content such as markdown, html, links, screenshots, or JSON extraction.',
  connectorId: 'firecrawl.api_key',
  inputSchema: firecrawlScrapeInputSchema,
  toRequest({ input }) {
    return {
      method: 'POST',
      url: `${FIRECRAWL_API_BASE}/v2/scrape`,
      headers: {
        'content-type': 'application/json',
      },
      body: input,
    }
  },
  handleResponse(response) {
    if (!response.ok) {
      return toolErrorFromProviderResponse(response, {
        label: 'Firecrawl scrape',
        errorCodeForStatus: (status) =>
          status === 429 ? 'rate_limited' : 'provider_error',
      })
    }

    if (response.truncated) {
      return toolError(
        'provider_error',
        'Firecrawl scrape response exceeded the tool response limit. Retry with fewer formats, narrower includeTags or excludeTags filters, or main-content-only output.'
      )
    }

    return toolSuccess({
      status: response.status,
      body: parseProviderResponseFromHttp(response),
      truncated: response.truncated,
    })
  },
})
