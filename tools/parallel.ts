import 'server-only'
import { z } from 'zod'
import {
  defineApiPassthroughTool,
  toolError,
  toolSuccess,
} from './define-maintainer-tool'

const PARALLEL_SEARCH_URL = 'https://api.parallel.ai/v1/search'
const PARALLEL_MAX_RESPONSE_BYTES = 128 * 1024
const PROVIDER_ERROR_BODY_LIMIT = 1000
const DOMAIN_OR_TLD_PATTERN =
  /^(?:\.[a-z0-9-]+(?:\.[a-z0-9-]+)*|[a-z0-9-]+(?:\.[a-z0-9-]+)+)$/i

const domainSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine(
    (value) => DOMAIN_OR_TLD_PATTERN.test(value),
    'Use a bare domain such as example.com or a bare domain extension such as .gov.'
  )

const afterDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format.')

const sourcePolicySchema = z
  .object({
    include_domains: z
      .array(domainSchema)
      .min(1)
      .max(200)
      .optional()
      .describe(
        'Optional allowlist of bare domains or domain extensions such as example.com or .gov. When set, only these sources may appear in results.'
      ),
    exclude_domains: z
      .array(domainSchema)
      .min(1)
      .max(200)
      .optional()
      .describe(
        'Optional blocklist of bare domains or domain extensions to exclude from results.'
      ),
    after_date: afterDateSchema
      .optional()
      .describe(
        'Optional freshness floor in YYYY-MM-DD format. Results should be published on or after this date.'
      ),
  })
  .strict()
  .superRefine((value, ctx) => {
    const total =
      (value.include_domains?.length ?? 0) +
      (value.exclude_domains?.length ?? 0)
    if (total > 200) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Combined include_domains and exclude_domains entries cannot exceed 200.',
        path: ['exclude_domains'],
      })
    }
  })

const fetchPolicySchema = z
  .object({
    max_age_seconds: z
      .number()
      .int()
      .min(600)
      .optional()
      .describe(
        'Optional maximum cached age in seconds before Parallel fetches live content. Minimum 600.'
      ),
    timeout_seconds: z
      .number()
      .positive()
      .optional()
      .describe('Optional timeout in seconds for live fetches.'),
    disable_cache_fallback: z
      .boolean()
      .optional()
      .describe(
        'When true, fail instead of falling back to older cached content if a live fetch times out or fails.'
      ),
  })
  .strict()

const excerptSettingsSchema = z
  .object({
    max_chars_per_result: z
      .number()
      .int()
      .min(1000)
      .optional()
      .describe(
        'Optional upper bound on excerpt characters per result. Values below 1000 are not allowed.'
      ),
  })
  .strict()

interface AdvancedSettingsInput {
  after_date?: string
  excerpt_settings?: z.infer<typeof excerptSettingsSchema>
  exclude_domains?: string[]
  fetch_policy?: z.infer<typeof fetchPolicySchema>
  include_domains?: string[]
  location?: string
  max_results?: number
  source_policy?: z.infer<typeof sourcePolicySchema>
}

function normalizeAdvancedSettings(
  value: AdvancedSettingsInput
): Omit<
  AdvancedSettingsInput,
  'after_date' | 'exclude_domains' | 'include_domains'
> {
  const normalizedSourcePolicy = {
    include_domains:
      value.source_policy?.include_domains ?? value.include_domains,
    exclude_domains:
      value.source_policy?.exclude_domains ?? value.exclude_domains,
    after_date: value.source_policy?.after_date ?? value.after_date,
  }
  const hasSourcePolicy =
    normalizedSourcePolicy.include_domains !== undefined ||
    normalizedSourcePolicy.exclude_domains !== undefined ||
    normalizedSourcePolicy.after_date !== undefined

  return {
    fetch_policy: value.fetch_policy,
    excerpt_settings: value.excerpt_settings,
    location: value.location,
    max_results: value.max_results,
    source_policy: hasSourcePolicy ? normalizedSourcePolicy : undefined,
  }
}

const advancedSettingsSchema = z
  .object({
    source_policy: sourcePolicySchema
      .optional()
      .describe(
        'Optional source filtering and freshness rules. Use sparingly because restrictive policies can reduce result quality.'
      ),
    include_domains: z
      .array(domainSchema)
      .min(1)
      .max(200)
      .optional()
      .describe(
        'Compatibility alias for source_policy.include_domains. Prefer nesting it under source_policy.'
      ),
    exclude_domains: z
      .array(domainSchema)
      .min(1)
      .max(200)
      .optional()
      .describe(
        'Compatibility alias for source_policy.exclude_domains. Prefer nesting it under source_policy.'
      ),
    after_date: afterDateSchema
      .optional()
      .describe(
        'Compatibility alias for source_policy.after_date. Prefer nesting it under source_policy.'
      ),
    fetch_policy: fetchPolicySchema
      .optional()
      .describe(
        'Optional live-fetch behavior. Enabling fresher fetches usually increases latency.'
      ),
    excerpt_settings: excerptSettingsSchema
      .optional()
      .describe('Optional controls for excerpt size per result.'),
    location: z
      .string()
      .trim()
      .regex(/^[a-zA-Z]{2}$/, 'Use a two-letter ISO country code.')
      .optional()
      .describe(
        'Optional ISO 3166-1 alpha-2 country code such as us, gb, de, or jp for geo-targeted results.'
      ),
    max_results: z
      .number()
      .int()
      .positive()
      .optional()
      .describe(
        'Optional upper bound on the number of search results to return.'
      ),
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasSourcePolicyAliases =
      value.include_domains !== undefined ||
      value.exclude_domains !== undefined ||
      value.after_date !== undefined

    if (!hasSourcePolicyAliases) {
      return
    }

    const normalized = normalizeAdvancedSettings(value)
    const total =
      (normalized.source_policy?.include_domains?.length ?? 0) +
      (normalized.source_policy?.exclude_domains?.length ?? 0)

    if (total > 200) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Combined include_domains and exclude_domains entries cannot exceed 200.',
        path: ['exclude_domains'],
      })
    }
  })

const parallelSearchInputSchema = z.object({
  objective: z
    .string()
    .trim()
    .min(1)
    .max(5000)
    .optional()
    .describe(
      'Optional natural-language research objective that explains what you want to learn from the web results.'
    ),
  search_queries: z
    .array(z.string().trim().min(1).max(200))
    .min(1)
    .max(5)
    .describe(
      'One to five concise keyword search queries. Use 2-3 diverse queries for best results, usually 3-6 words each.'
    ),
  mode: z
    .enum(['basic', 'advanced'])
    .default('advanced')
    .describe(
      'Search quality and latency preset. Use advanced for higher quality and basic for faster responses.'
    ),
  max_chars_total: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      'Optional upper bound on total excerpt characters returned across all results.'
    ),
  session_id: z
    .string()
    .trim()
    .min(1)
    .max(1000)
    .optional()
    .describe(
      'Optional session identifier to reuse across related Parallel search or extract calls for the same broader task.'
    ),
  client_model: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe(
      'Optional name of the model that will consume the results, such as claude-opus-4-7, gpt-5.4, or gemini-3.1-pro.'
    ),
  advanced_settings: advancedSettingsSchema
    .optional()
    .describe(
      'Optional advanced controls for source filtering, live fetches, excerpt sizing, location, and result count. Omit unless you truly need them.'
    ),
})

const parallelWarningSchema = z.object({
  type: z.enum([
    'spec_validation_warning',
    'input_validation_warning',
    'warning',
  ]),
  message: z.string(),
  detail: z.record(z.unknown()).nullable().optional(),
})

const parallelUsageItemSchema = z.object({
  name: z.string(),
  count: z.number().int(),
})

const parallelResultSchema = z.object({
  url: z.string(),
  title: z.string().nullable().optional(),
  publish_date: z.string().nullable().optional(),
  excerpts: z.array(z.string()),
})

const parallelSearchResponseSchema = z.object({
  search_id: z.string(),
  results: z.array(parallelResultSchema),
  warnings: z.array(parallelWarningSchema).nullable().optional(),
  usage: z.array(parallelUsageItemSchema).nullable().optional(),
  session_id: z.string(),
})

const parallelErrorResponseSchema = z.object({
  type: z.literal('error'),
  error: z.object({
    ref_id: z.string().optional(),
    message: z.string(),
    detail: z.record(z.unknown()).nullable().optional(),
  }),
})

function parseJsonBody(raw: string): unknown | null {
  const trimmed = raw.trim()
  if (!trimmed) {
    return null
  }
  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    return null
  }
}

function buildProviderErrorMessage(response: {
  bodyText: string
  status: number
  truncated: boolean
}): string {
  const parsed = parseJsonBody(response.bodyText)
  const normalized = parsed
    ? parallelErrorResponseSchema.safeParse(parsed)
    : { success: false as const }

  if (normalized.success) {
    return `Parallel Search API request failed (HTTP ${response.status}): ${normalized.data.error.message}`
  }

  const body = response.bodyText.trim()
  if (!body) {
    return `Parallel Search API request failed (HTTP ${response.status}).`
  }

  const clipped = body.slice(0, PROVIDER_ERROR_BODY_LIMIT)
  const suffix =
    response.truncated || body.length > PROVIDER_ERROR_BODY_LIMIT
      ? ' [truncated]'
      : ''
  return `Parallel Search API request failed (HTTP ${response.status}): ${clipped}${suffix}`
}

export const parallelSearchTool = defineApiPassthroughTool({
  id: 'parallel_search',
  category: 'browser',
  displayName: 'Parallel · Search',
  description:
    'Search the live web through Parallel and return ranked, LLM-optimized excerpts for current research questions.',
  provider: 'parallel',
  inputSchema: parallelSearchInputSchema,
  toRequest({ input }) {
    const advancedSettings = input.advanced_settings
      ? normalizeAdvancedSettings(input.advanced_settings)
      : undefined

    return {
      method: 'POST',
      url: PARALLEL_SEARCH_URL,
      headers: { 'content-type': 'application/json' },
      maxResponseBytes: PARALLEL_MAX_RESPONSE_BYTES,
      body: {
        objective: input.objective,
        search_queries: input.search_queries,
        mode: input.mode,
        max_chars_total: input.max_chars_total,
        session_id: input.session_id,
        client_model: input.client_model,
        advanced_settings: advancedSettings,
      },
    }
  },
  handleResponse(response) {
    if (!response.ok) {
      return toolError('provider_error', buildProviderErrorMessage(response))
    }

    if (response.truncated) {
      return toolError(
        'provider_error',
        'Parallel Search API response exceeded the tool response limit. Retry with a lower max_chars_total, fewer max_results, or smaller excerpt_settings.max_chars_per_result.'
      )
    }

    const parsedBody = parseJsonBody(response.bodyText)
    if (parsedBody === null) {
      return toolError(
        'provider_error',
        'Parallel Search API returned an empty or invalid JSON response.'
      )
    }

    const parsed = parallelSearchResponseSchema.safeParse(parsedBody)
    if (!parsed.success) {
      return toolError(
        'provider_error',
        'Parallel Search API returned an unexpected response shape.'
      )
    }

    return toolSuccess({
      searchId: parsed.data.search_id,
      sessionId: parsed.data.session_id,
      resultCount: parsed.data.results.length,
      results: parsed.data.results.map((result, index) => ({
        rank: index + 1,
        url: result.url,
        title: result.title ?? null,
        publishDate: result.publish_date ?? null,
        excerpts: result.excerpts,
      })),
      warnings: (parsed.data.warnings ?? []).map((warning) => ({
        type: warning.type,
        message: warning.message,
        detail: warning.detail ?? null,
      })),
      usage: (parsed.data.usage ?? []).map((item) => ({
        name: item.name,
        count: item.count,
      })),
    })
  },
})
