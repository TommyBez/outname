import { expect, test, vi } from 'vitest'
import { z } from 'zod'
import { resolveBundleChildren, toBundleExposedTools } from './bundle-tools'
import {
  defineApiPassthroughTool,
  defineToolBundle,
  toolSuccess,
} from './index'
import type { BundleChildToolArgs } from './types'

const { mockBrokeredHttpRequest, mockDecryptCredential } = vi.hoisted(() => ({
  mockBrokeredHttpRequest: vi.fn(),
  mockDecryptCredential: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@/connections/crypto', () => ({
  decryptCredential: mockDecryptCredential,
  encryptCredential: vi.fn(),
}))

vi.mock('../brokered-http', () => ({
  brokeredHttpRequest: mockBrokeredHttpRequest,
}))

interface TestConfig {
  enableWrite: boolean
}

const testTools: Record<string, BundleChildToolArgs<TestConfig>> = {
  test_read: {
    displayName: 'Test Read',
    description: 'Read-only child tool.',
    inputSchema: z.object({}),
    execute: () => ({ ok: true as const, data: 'read' }),
  },
  test_write: {
    displayName: 'Test Write',
    description: 'Writable child tool.',
    inputSchema: z.object({}),
    isEnabled(config) {
      return config.enableWrite
    },
    execute: () => ({ ok: true as const, data: 'write' }),
  },
}

test('toBundleExposedTools filters disabled child tools from config', () => {
  expect(toBundleExposedTools(testTools).map((tool) => tool.toolId)).toEqual([
    'test_read',
    'test_write',
  ])
  expect(
    toBundleExposedTools(testTools, { enableWrite: false }).map(
      (tool) => tool.toolId
    )
  ).toEqual(['test_read'])
})

test('resolveBundleChildren only returns enabled child tools', () => {
  expect(
    resolveBundleChildren(testTools, { enableWrite: false }).map(
      ([toolId]) => toolId
    )
  ).toEqual(['test_read'])
})

test('bundle child tools inherit the bundle sandbox manifest id', async () => {
  const bundle = defineToolBundle({
    id: 'test_bundle',
    category: 'test',
    displayName: 'Test Bundle',
    description: 'Bundle used to verify sandbox manifest propagation.',
    capabilities: [{ kind: 'tool_sandbox', manifest: 'missing-manifest' }],
    sandboxManifestId: 'missing-manifest',
    tools: {
      test_run: {
        displayName: 'Test Run',
        description: 'Run a sandbox-backed child tool.',
        inputSchema: z.object({}),
        async execute({ ctx }) {
          await ctx.sandbox.run({ cmd: 'echo', args: ['hello'] })
          return toolSuccess('ok')
        },
      },
    },
  })

  const built = bundle.build({
    agentId: 'agent_test',
    config: {},
    conversationId: null,
    runId: 'run_test',
    toolId: 'test_bundle',
    userId: 'user_test',
  }) as unknown as Record<
    string,
    {
      execute(input: Record<string, never>): Promise<{
        code?: string
        message?: string
        ok: boolean
      }>
    }
  >

  const result = await built.test_run.execute({})
  expect(result.ok).toBe(false)
  expect(result.message).toBe('Unknown tool sandbox manifest: missing-manifest')
})

test('brokered tools receive apiKeyOverride from preserved tool config', async () => {
  let executeConfig: unknown
  mockDecryptCredential.mockResolvedValueOnce('override-token')
  mockBrokeredHttpRequest.mockResolvedValueOnce({
    bodyText: '{}',
    headers: {},
    ok: true,
    status: 200,
    truncated: false,
  })

  const apiTool = defineApiPassthroughTool({
    id: 'test_api',
    category: 'test',
    displayName: 'Test API',
    description: 'Brokered API tool.',
    provider: 'x',
    configSchema: z.strictObject({
      readOnly: z.boolean().default(false),
    }),
    inputSchema: z.object({}),
    toRequest(args) {
      executeConfig = args.config
      return {
        method: 'GET',
        url: 'https://api.x.com/2/users/me',
      }
    },
    handleResponse(response) {
      return toolSuccess(response.status)
    },
  })

  const built = apiTool.build({
    agentId: 'agent_test',
    config: {
      _secrets: {
        apiKeyOverride: {
          encrypted: 'encrypted-token',
          version: 1,
        },
      },
      readOnly: true,
    },
    conversationId: null,
    runId: 'run_test',
    toolId: 'test_api',
    userId: 'user_test',
  }) as unknown as {
    execute(input: Record<string, never>): Promise<{
      data?: number
      ok: boolean
    }>
  }

  await expect(built.execute({})).resolves.toEqual({
    data: 200,
    ok: true,
  })
  expect(executeConfig).toEqual({ readOnly: true })
  expect(mockBrokeredHttpRequest).toHaveBeenCalledWith(
    expect.objectContaining({
      apiKeyOverride: 'override-token',
      attachmentToolId: 'test_api',
      provider: 'x',
      toolId: 'test_api',
    })
  )
})
