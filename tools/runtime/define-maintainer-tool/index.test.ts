import { expect, test } from 'vitest'
import { z } from 'zod'
import { resolveBundleChildren, toBundleExposedTools } from './bundle-tools'
import { defineToolBundle, toolSuccess } from './index'
import type { BundleChildToolArgs } from './types'

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
  }) as Record<
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
  assert.equal(result.ok, false)
  assert.equal(
    result.message,
    'Unknown tool sandbox manifest: missing-manifest'
  )
})
