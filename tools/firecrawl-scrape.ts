import 'server-only'
import { z } from 'zod'
import {
  defineApiPassthroughTool,
  toolError,
  toolSuccess,
} from './define-maintainer-tool'

const FIRECRAWL_API_BASE = 'https://api.firecrawl.dev'
const PROVIDER_ERROR_BODY_LIMIT = 1000

const firecrawlScrapeInputSchema = z.object({
  url: z.string().url().describe('The page URL to scrape.'),
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

function clippedProviderError(response: {
  bodyText: string
  status: number
  truncated: boolean
}): string {
  const body = response.bodyText.trim()
  if (!body) {
    return `Firecrawl scrape failed (HTTP ${response.status}).`
  }
  const truncated =
    response.truncated || body.length > PROVIDER_ERROR_BODY_LIMIT
  const suffix = truncated ? ' [truncated]' : ''
  return `Firecrawl scrape failed (HTTP ${response.status}): ${body.slice(0, PROVIDER_ERROR_BODY_LIMIT)}${suffix}`
}

function parseResponseBody(
  raw: string,
  contentType: string | undefined
): unknown {
  if (raw.length === 0) {
    return null
  }
  if (contentType?.includes('application/json')) {
    try {
      return JSON.parse(raw) as unknown
    } catch {
      return raw
    }
  }
  return raw
}

export const firecrawlScrapeTool = defineApiPassthroughTool({
  id: 'firecrawl_scrape',
  category: 'browser',
  displayName: 'Firecrawl · Scrape',
  description:
    'Scrape a single URL using Firecrawl Scrape API (v2) and return structured content such as markdown, html, links, screenshots, or JSON extraction.',
  provider: 'firecrawl',
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
      if (response.status === 429) {
        return toolError('rate_limited', clippedProviderError(response))
      }
      return toolError('provider_error', clippedProviderError(response))
    }

    if (response.truncated) {
      return toolError(
        'provider_error',
        'Firecrawl scrape response exceeded the tool response limit. Retry with fewer formats, narrower includeTags or excludeTags filters, or main-content-only output.'
      )
    }

    return toolSuccess({
      status: response.status,
      body: parseResponseBody(
        response.bodyText,
        response.headers['content-type']
      ),
      truncated: response.truncated,
    })
  },
})
