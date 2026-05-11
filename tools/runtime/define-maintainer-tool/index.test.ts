import assert from 'node:assert/strict'
import test from 'node:test'
import { z } from 'zod'
import { resolveBundleChildren, toBundleExposedTools } from './bundle-tools'
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
  assert.deepEqual(
    toBundleExposedTools(testTools).map((tool) => tool.toolId),
    ['test_read', 'test_write']
  )
  assert.deepEqual(
    toBundleExposedTools(testTools, { enableWrite: false }).map(
      (tool) => tool.toolId
    ),
    ['test_read']
  )
})

test('resolveBundleChildren only returns enabled child tools', () => {
  assert.deepEqual(
    resolveBundleChildren(testTools, { enableWrite: false }).map(
      ([toolId]) => toolId
    ),
    ['test_read']
  )
})
