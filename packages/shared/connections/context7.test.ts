import { afterEach, expect, test, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { context7Connector } from './context7'

const API_KEY = 'ctx7sk_test_key'

afterEach(() => {
  vi.restoreAllMocks()
})

test('validate returns the existing HTTP error for rejected keys', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: false,
    status: 401,
  } as Response)

  const result = await context7Connector.apiKey.validate?.({
    apiKey: API_KEY,
  })

  expect(result).toEqual({
    ok: false,
    error:
      'Context7 rejected the API key (HTTP 401). Verify the key and try again.',
  })
})

test('validate returns a contract error on network failures', async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'))

  const result = await context7Connector.apiKey.validate?.({
    apiKey: API_KEY,
  })

  expect(result).toEqual({
    ok: false,
    error: 'Context7 validation failed: network down',
  })
})

test('validate returns a contract error on JSON parse failures', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: vi.fn().mockRejectedValue(new Error('invalid json')),
  } as unknown as Response)

  const result = await context7Connector.apiKey.validate?.({
    apiKey: API_KEY,
  })

  expect(result).toEqual({
    ok: false,
    error: 'Context7 validation failed: invalid json',
  })
})
