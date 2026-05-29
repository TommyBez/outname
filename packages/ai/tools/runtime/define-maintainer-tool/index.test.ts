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

vi.mock('@outname/shared/connections/crypto', () => ({
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

test('bundle exposed tools ignore credential override fields when parsing strict config', () => {
  const bundle = defineToolBundle({
    id: 'test_bundle_exposed_tools',
    category: 'test',
    displayName: 'Test Bundle Exposed Tools',
    description: 'Bundle used to verify exposed tool resolution.',
    capabilities: [{ kind: 'brokered_http', connectorId: 'x.bearer_token' }],
    configSchema: z.strictObject({
      enableWrite: z.boolean().default(false),
    }),
    tools: testTools,
  })

  expect(
    bundle.resolveExposedTools({
      apiKeyOverride: 'live-token',
      credentialOverrides: {
        x: { bearerToken: 'live-token' },
      },
      enableWrite: false,
    })
  ).toEqual([
    {
      description: 'Read-only child tool.',
      displayName: 'Test Read',
      toolId: 'test_read',
    },
  ])
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
  expect(result.message).toBe(
    'tool sandbox manifest unavailable for "missing-manifest": Unknown tool sandbox manifest: missing-manifest'
  )
})

test('brokered tools receive encrypted credential overrides in preserved tool config', async () => {
  let executeConfig: unknown
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
    connectorId: 'x.bearer_token',
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
        credentialOverrides: {
          x: {
            encrypted: 'encrypted-token',
            version: 1,
          },
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
      attachmentToolId: 'test_api',
      connectorId: 'x.bearer_token',
      toolConfig: {
        _secrets: {
          credentialOverrides: {
            x: {
              encrypted: 'encrypted-token',
              version: 1,
            },
          },
        },
        readOnly: true,
      },
      toolId: 'test_api',
    })
  )
})
