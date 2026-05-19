import { expect, test, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type { ToolRuntimeContext } from '@/tools/runtime/define-maintainer-tool'
import { executeGetContext, executeSearchLibraries } from './context7'

function createRuntimeContext(response: {
  bodyText: string
  headers: Record<string, string>
  ok: boolean
  status: number
  truncated: boolean
}) {
  const request = vi.fn().mockResolvedValue(response)
  const ctx = {
    agentId: 'agent_123',
    attachmentToolId: 'context7_docs',
    audit: {
      async record() {
        // Intentionally unused in these unit tests.
      },
    },
    conversationId: null,
    credentials: {
      read() {
        return Promise.reject(new Error('Not used in these tests.'))
      },
    },
    http: { request },
    runId: null,
    sandbox: {
      run() {
        return Promise.reject(new Error('Not used in these tests.'))
      },
    },
    toolId: 'context7_docs',
    userId: 'user_123',
  } as ToolRuntimeContext

  return { ctx, request }
}

test('executeSearchLibraries returns parsed search results', async () => {
  const { ctx, request } = createRuntimeContext({
    ok: true,
    status: 200,
    truncated: false,
    headers: {
      'content-type': 'application/json',
    },
    bodyText: JSON.stringify({
      results: [
        {
          id: '/vercel/next.js',
          title: 'Next.js',
          description: 'The React framework',
          stars: 131_745,
          trustScore: 10,
          benchmarkScore: 95.5,
        },
      ],
      searchFilterApplied: false,
    }),
  })

  const result = await executeSearchLibraries({
    ctx,
    input: {
      libraryName: 'next.js',
      query: 'How do I implement middleware auth?',
      fast: false,
      maxResponseBytes: 48 * 1024,
    },
  })

  expect(result).toEqual({
    ok: true,
    data: {
      libraryName: 'next.js',
      query: 'How do I implement middleware auth?',
      resultCount: 1,
      searchFilterApplied: false,
      results: [
        {
          id: '/vercel/next.js',
          title: 'Next.js',
          description: 'The React framework',
          stars: 131_745,
          trustScore: 10,
          benchmarkScore: 95.5,
        },
      ],
    },
  })

  expect(request).toHaveBeenCalledOnce()
  const [, outboundRequest] = request.mock.calls[0] ?? []
  const url = new URL(outboundRequest.url as string)
  expect(url.pathname).toBe('/api/v2/libs/search')
  expect(url.searchParams.get('libraryName')).toBe('next.js')
  expect(url.searchParams.get('query')).toBe(
    'How do I implement middleware auth?'
  )
})

test('executeSearchLibraries rejects truncated responses', async () => {
  const { ctx } = createRuntimeContext({
    ok: true,
    status: 200,
    truncated: true,
    headers: {
      'content-type': 'application/json',
    },
    bodyText: '{"results":[',
  })

  const result = await executeSearchLibraries({
    ctx,
    input: {
      libraryName: 'react',
      query: 'How do I use hooks?',
      fast: false,
      maxResponseBytes: 48 * 1024,
    },
  })

  expect(result).toEqual({
    ok: false,
    code: 'provider_error',
    message:
      'Context7 search results exceeded the tool response limit. Retry with a narrower libraryName or larger maxResponseBytes.',
  })
})

test('executeSearchLibraries normalizes thrown request errors', async () => {
  const { ctx } = createRuntimeContext({
    ok: true,
    status: 200,
    truncated: false,
    headers: {
      'content-type': 'application/json',
    },
    bodyText: '{}',
  })
  ctx.http.request = vi.fn().mockRejectedValue(new Error('socket hang up'))

  const result = await executeSearchLibraries({
    ctx,
    input: {
      libraryName: 'react',
      query: 'How do I use hooks?',
      fast: false,
      maxResponseBytes: 48 * 1024,
    },
  })

  expect(result).toEqual({
    ok: false,
    code: 'provider_error',
    message: 'Context7 search libraries failed: socket hang up',
  })
})

test('executeGetContext returns unavailable for unfinalized libraries', async () => {
  const { ctx } = createRuntimeContext({
    ok: true,
    status: 202,
    truncated: false,
    headers: {
      'content-type': 'application/json',
    },
    bodyText: JSON.stringify({
      error: 'library_not_finalized',
      message: 'Library /vercel/next.js not finalized yet.',
    }),
  })

  const result = await executeGetContext({
    ctx,
    input: {
      libraryId: '/vercel/next.js',
      query: 'How do I use middleware?',
      type: 'json',
      fast: false,
      maxResponseBytes: 128 * 1024,
    },
  })

  expect(result).toEqual({
    ok: false,
    code: 'unavailable',
    message:
      'Context7 has not finalized this library yet. Retry later or request a different library/version.',
  })
})

test('executeGetContext normalizes thrown request errors', async () => {
  const { ctx } = createRuntimeContext({
    ok: true,
    status: 200,
    truncated: false,
    headers: {
      'content-type': 'application/json',
    },
    bodyText: '{}',
  })
  ctx.http.request = vi.fn().mockRejectedValue(new Error('upstream reset'))

  const result = await executeGetContext({
    ctx,
    input: {
      libraryId: '/vercel/next.js',
      query: 'How do I implement auth middleware?',
      type: 'json',
      fast: false,
      maxResponseBytes: 128 * 1024,
    },
  })

  expect(result).toEqual({
    ok: false,
    code: 'provider_error',
    message: 'Context7 get context failed: upstream reset',
  })
})

test('executeGetContext returns parsed json snippets', async () => {
  const { ctx, request } = createRuntimeContext({
    ok: true,
    status: 200,
    truncated: false,
    headers: {
      'content-type': 'application/json',
    },
    bodyText: JSON.stringify({
      codeSnippets: [
        {
          codeTitle: 'Middleware Authentication Example',
          codeDescription: 'Shows an auth check in middleware.',
          codeLanguage: 'typescript',
          codeTokens: 150,
          codeId:
            'https://github.com/vercel/next.js/blob/canary/docs/middleware.mdx#_snippet_0',
          pageTitle: 'Middleware',
          codeList: [
            {
              language: 'typescript',
              code: 'export function middleware() { return NextResponse.next() }',
            },
          ],
        },
      ],
      infoSnippets: [
        {
          pageId:
            'https://github.com/vercel/next.js/blob/canary/docs/middleware.mdx',
          breadcrumb: 'Routing > Middleware',
          content: 'Middleware runs before a request is completed.',
          contentTokens: 40,
        },
      ],
      rules: {
        global: ['Prefer App Router examples where possible.'],
      },
    }),
  })

  const result = await executeGetContext({
    ctx,
    input: {
      libraryId: '/vercel/next.js',
      query: 'How do I implement auth middleware?',
      type: 'json',
      fast: false,
      maxResponseBytes: 128 * 1024,
    },
  })

  expect(result).toEqual({
    ok: true,
    data: {
      libraryId: '/vercel/next.js',
      query: 'How do I implement auth middleware?',
      responseType: 'json',
      codeSnippetCount: 1,
      infoSnippetCount: 1,
      codeSnippets: [
        {
          codeTitle: 'Middleware Authentication Example',
          codeDescription: 'Shows an auth check in middleware.',
          codeLanguage: 'typescript',
          codeTokens: 150,
          codeId:
            'https://github.com/vercel/next.js/blob/canary/docs/middleware.mdx#_snippet_0',
          pageTitle: 'Middleware',
          codeList: [
            {
              language: 'typescript',
              code: 'export function middleware() { return NextResponse.next() }',
            },
          ],
        },
      ],
      infoSnippets: [
        {
          pageId:
            'https://github.com/vercel/next.js/blob/canary/docs/middleware.mdx',
          breadcrumb: 'Routing > Middleware',
          content: 'Middleware runs before a request is completed.',
          contentTokens: 40,
        },
      ],
      rules: {
        global: ['Prefer App Router examples where possible.'],
      },
    },
  })

  expect(request).toHaveBeenCalledOnce()
  const [, outboundRequest] = request.mock.calls[0] ?? []
  expect(outboundRequest.headers).toEqual({ accept: 'application/json' })
})
