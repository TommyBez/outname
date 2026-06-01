import 'server-only'
import {
  defineToolBundle,
  type ToolRuntimeContext,
  toolError,
  toolSuccess,
} from '@outname/ai/tools/runtime/define-maintainer-tool'
import { toolErrorFromProviderResponse } from '@outname/ai/tools/runtime/define-maintainer-tool/provider-response'
import { z } from 'zod'

const CONTEXT7_API_BASE = 'https://context7.com/api'
const CONTEXT7_SEARCH_MAX_RESPONSE_BYTES = 48 * 1024
const CONTEXT7_CONTEXT_DEFAULT_RESPONSE_BYTES = 128 * 1024
const CONTEXT7_CONTEXT_MAX_RESPONSE_BYTES = 256 * 1024

const context7SearchLibraryInputSchema = z.object({
  libraryName: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .describe(
      'Library name to search for, such as "react", "next.js", or "supabase".'
    ),
  query: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .describe(
      'The actual task or question. Context7 uses this to rank search results by relevance.'
    ),
  fast: z
    .boolean()
    .default(false)
    .describe(
      'When true, skips LLM reranking for lower latency and potentially lower relevance quality.'
    ),
  maxResponseBytes: z
    .number()
    .int()
    .min(4000)
    .max(CONTEXT7_CONTEXT_MAX_RESPONSE_BYTES)
    .default(CONTEXT7_SEARCH_MAX_RESPONSE_BYTES)
    .describe(
      'Maximum response body bytes to return. Increase if you expect many matching libraries.'
    ),
})

const context7ResponseTypeSchema = z.enum(['json', 'txt'])

const context7GetContextInputSchema = z.object({
  libraryId: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .describe(
      'Context7 library ID such as "/vercel/next.js", "/websites/uploadcare_com", or a version-pinned variant.'
    ),
  query: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .describe(
      'Specific question or task to answer with documentation context. Be explicit for better results.'
    ),
  type: context7ResponseTypeSchema
    .default('json')
    .describe(
      'Response format. Use "json" for structured snippets or "txt" for prompt-ready plain text.'
    ),
  fast: z
    .boolean()
    .default(false)
    .describe(
      'When true, skips LLM reranking for lower latency and potentially lower relevance quality.'
    ),
  maxResponseBytes: z
    .number()
    .int()
    .min(4000)
    .max(CONTEXT7_CONTEXT_MAX_RESPONSE_BYTES)
    .default(CONTEXT7_CONTEXT_DEFAULT_RESPONSE_BYTES)
    .describe(
      'Maximum response body bytes to return. Increase for broader queries or larger snippet sets.'
    ),
})

const context7SearchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  branch: z.string().optional(),
  lastUpdateDate: z.string().optional(),
  state: z.string().optional(),
  totalTokens: z.number().optional(),
  totalSnippets: z.number().optional(),
  stars: z.number().optional(),
  trustScore: z.number().optional(),
  benchmarkScore: z.number().optional(),
  versions: z.array(z.string()).optional(),
})

const context7SearchResponseSchema = z.object({
  results: z.array(context7SearchResultSchema),
  searchFilterApplied: z.boolean(),
})

const context7CodeExampleSchema = z.object({
  language: z.string(),
  code: z.string(),
})

const context7CodeSnippetSchema = z.object({
  codeTitle: z.string(),
  codeDescription: z.string(),
  codeLanguage: z.string(),
  codeTokens: z.number(),
  codeId: z.string(),
  pageTitle: z.string(),
  codeList: z.array(context7CodeExampleSchema),
  isDynamic: z.boolean().optional(),
  sourceFile: z.string().optional(),
})

const context7InfoSnippetSchema = z.object({
  pageId: z.string().optional(),
  breadcrumb: z.string().optional(),
  content: z.string(),
  contentTokens: z.number(),
})

const context7RulesSchema = z
  .object({
    global: z.array(z.string()).optional(),
    libraryOwn: z.array(z.string()).optional(),
    libraryTeam: z.array(z.string()).optional(),
  })
  .optional()

const context7ContextResponseSchema = z.object({
  codeSnippets: z.array(context7CodeSnippetSchema),
  infoSnippets: z.array(context7InfoSnippetSchema),
  rules: context7RulesSchema,
})

type Context7GetContextInput = z.infer<typeof context7GetContextInputSchema>
type Context7SearchLibraryInput = z.infer<
  typeof context7SearchLibraryInputSchema
>

function buildContext7Url(
  pathname: string,
  query: Record<string, string | boolean | undefined>
): string {
  const url = new URL(`${CONTEXT7_API_BASE}${pathname}`)
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

function context7ErrorCodeForStatus(status: number) {
  if (status === 429) {
    return 'rate_limited'
  }
  if (status === 202) {
    return 'unavailable'
  }
  return 'provider_error'
}

function parseJsonBody<TSchema extends z.ZodTypeAny>(
  responseText: string,
  schema: TSchema
): z.infer<TSchema> | null {
  try {
    const parsed = JSON.parse(responseText) as unknown
    const validated = schema.safeParse(parsed)
    return validated.success ? validated.data : null
  } catch {
    return null
  }
}

function truncatedResponseError(message: string) {
  return toolError('provider_error', message)
}

function providerRuntimeError(label: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return toolError('provider_error', `${label} failed: ${message}`)
}

export async function executeSearchLibraries(input: {
  ctx: ToolRuntimeContext
  input: Context7SearchLibraryInput
}) {
  try {
    const response = await input.ctx.http.request('context7.api_key', {
      method: 'GET',
      url: buildContext7Url('/v2/libs/search', {
        libraryName: input.input.libraryName,
        query: input.input.query,
        fast: input.input.fast ? 'true' : undefined,
      }),
      maxResponseBytes: input.input.maxResponseBytes,
    })

    if (!response.ok) {
      return toolErrorFromProviderResponse(response, {
        label: 'Context7 search libraries',
        errorCodeForStatus: context7ErrorCodeForStatus,
      })
    }

    if (response.truncated) {
      return truncatedResponseError(
        'Context7 search results exceeded the tool response limit. Retry with a narrower libraryName or larger maxResponseBytes.'
      )
    }

    const parsed = parseJsonBody(
      response.bodyText,
      context7SearchResponseSchema
    )
    if (parsed === null) {
      return toolError(
        'provider_error',
        'Context7 search libraries returned an empty or unexpected JSON response.'
      )
    }

    return toolSuccess({
      libraryName: input.input.libraryName,
      query: input.input.query,
      resultCount: parsed.results.length,
      searchFilterApplied: parsed.searchFilterApplied,
      results: parsed.results,
    })
  } catch (error) {
    return providerRuntimeError('Context7 search libraries', error)
  }
}

export async function executeGetContext(input: {
  ctx: ToolRuntimeContext
  input: Context7GetContextInput
}) {
  try {
    const response = await input.ctx.http.request('context7.api_key', {
      method: 'GET',
      url: buildContext7Url('/v2/context', {
        libraryId: input.input.libraryId,
        query: input.input.query,
        type: input.input.type,
        fast: input.input.fast ? 'true' : undefined,
      }),
      headers: {
        accept: input.input.type === 'txt' ? 'text/plain' : 'application/json',
      },
      maxResponseBytes: input.input.maxResponseBytes,
    })

    if (response.status === 202) {
      return toolError(
        'unavailable',
        'Context7 has not finalized this library yet. Retry later or request a different library/version.'
      )
    }

    if (!response.ok) {
      return toolErrorFromProviderResponse(response, {
        label: 'Context7 get context',
        errorCodeForStatus: context7ErrorCodeForStatus,
      })
    }

    if (response.truncated) {
      return truncatedResponseError(
        input.input.type === 'txt'
          ? 'Context7 text context exceeded the tool response limit. Retry with a narrower query or larger maxResponseBytes.'
          : 'Context7 JSON context exceeded the tool response limit. Retry with a narrower query, type="txt", or larger maxResponseBytes.'
      )
    }

    if (input.input.type === 'txt') {
      if (response.bodyText.trim().length === 0) {
        return toolError(
          'provider_error',
          'Context7 returned an empty text context response.'
        )
      }

      return toolSuccess({
        libraryId: input.input.libraryId,
        query: input.input.query,
        responseType: input.input.type,
        context: response.bodyText,
      })
    }

    const parsed = parseJsonBody(
      response.bodyText,
      context7ContextResponseSchema
    )
    if (parsed === null) {
      return toolError(
        'provider_error',
        'Context7 get context returned an empty or unexpected JSON response.'
      )
    }

    return toolSuccess({
      libraryId: input.input.libraryId,
      query: input.input.query,
      responseType: input.input.type,
      codeSnippetCount: parsed.codeSnippets.length,
      infoSnippetCount: parsed.infoSnippets.length,
      codeSnippets: parsed.codeSnippets,
      infoSnippets: parsed.infoSnippets,
      rules: parsed.rules,
    })
  } catch (error) {
    return providerRuntimeError('Context7 get context', error)
  }
}

export const context7DocsTool = defineToolBundle({
  id: 'context7_docs',
  category: 'browser',
  displayName: 'Context7 · Docs',
  displayDescription: 'Look up up-to-date library documentation while coding.',
  description:
    'Search Context7 libraries and retrieve up-to-date documentation context for specific implementation questions.',
  capabilities: [{ kind: 'brokered_http', connectorId: 'context7.api_key' }],
  tools: {
    context7_search_libraries: {
      displayName: 'Context7 · Search Libraries',
      displayDescription:
        'Find the right library docs for a framework or package.',
      description:
        'Search Context7 for libraries matching a name and rank them using the user question or task.',
      inputSchema: context7SearchLibraryInputSchema,
      async execute({ ctx, input }) {
        return await executeSearchLibraries({
          ctx,
          input: context7SearchLibraryInputSchema.parse(input),
        })
      },
    },
    context7_get_context: {
      displayName: 'Context7 · Get Context',
      displayDescription:
        'Pull documentation snippets for a specific library and question.',
      description:
        'Fetch Context7 documentation snippets for a specific library ID and question, returning JSON snippets or prompt-ready text.',
      inputSchema: context7GetContextInputSchema,
      async execute({ ctx, input }) {
        return await executeGetContext({
          ctx,
          input: context7GetContextInputSchema.parse(input),
        })
      },
    },
  },
})
