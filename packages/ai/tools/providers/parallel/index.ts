import 'server-only'

import {
  defineApiPassthroughTool,
  toolError,
  toolSuccess,
} from '@outname/ai/tools/runtime/define-maintainer-tool'
import {
  buildProviderErrorMessage,
  formatParallelSearchResult,
  parallelSearchResponseSchema,
  parseJsonBody,
} from './response'
import { normalizeAdvancedSettings, parallelSearchInputSchema } from './schemas'

const PARALLEL_SEARCH_URL = 'https://api.parallel.ai/v1/search'
const PARALLEL_MAX_RESPONSE_BYTES = 128 * 1024

export const parallelSearchTool = defineApiPassthroughTool({
  id: 'parallel_search',
  category: 'browser',
  displayName: 'Parallel · Search',
  displayDescription: 'Search the live web for up-to-date research answers.',
  description:
    'Search the live web through Parallel and return ranked, LLM-optimized excerpts for current research questions.',
  connectorId: 'parallel.api_key',
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

    return toolSuccess(formatParallelSearchResult(parsed.data))
  },
})
