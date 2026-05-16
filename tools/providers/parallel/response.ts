import { z } from 'zod'

const PROVIDER_ERROR_BODY_LIMIT = 1000

const parallelWarningSchema = z.object({
  type: z.enum([
    'spec_validation_warning',
    'input_validation_warning',
    'warning',
  ]),
  message: z.string(),
  detail: z.record(z.string(), z.unknown()).nullable().optional(),
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

export const parallelSearchResponseSchema = z.object({
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
    detail: z.record(z.string(), z.unknown()).nullable().optional(),
  }),
})

export function parseJsonBody(raw: string): unknown | null {
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

export function buildProviderErrorMessage(response: {
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

export function formatParallelSearchResult(
  parsed: z.infer<typeof parallelSearchResponseSchema>
) {
  return {
    searchId: parsed.search_id,
    sessionId: parsed.session_id,
    resultCount: parsed.results.length,
    results: parsed.results.map((result, index) => ({
      rank: index + 1,
      url: result.url,
      title: result.title ?? null,
      publishDate: result.publish_date ?? null,
      excerpts: result.excerpts,
    })),
    warnings: (parsed.warnings ?? []).map((warning) => ({
      type: warning.type,
      message: warning.message,
      detail: warning.detail ?? null,
    })),
    usage: (parsed.usage ?? []).map((item) => ({
      name: item.name,
      count: item.count,
    })),
  }
}
