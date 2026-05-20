import { beforeEach, expect, test, vi } from 'vitest'
import type { getConnector } from '@/connections/registry'

const { mockReadProviderCredential, mockSandboxCreate } = vi.hoisted(() => ({
  mockReadProviderCredential: vi.fn(),
  mockSandboxCreate: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@vercel/sandbox', () => ({
  Sandbox: {
    create: mockSandboxCreate,
  },
}))

vi.mock('@/shared/server/vercel-sandbox-config', () => ({
  brokeredHttpSandboxTags: vi.fn(() => ({ run: 'run_test' })),
}))

vi.mock('@/tools/runtime/define-maintainer-tool/credential-resolver', () => ({
  readProviderCredential: mockReadProviderCredential,
}))

import { createBrokerSandbox } from './sandbox'

beforeEach(() => {
  mockReadProviderCredential.mockReset()
  mockSandboxCreate.mockReset()
})

test('brokered HTTP header injection receives connector-shaped override credentials', async () => {
  const injectedHeaders = vi.fn((credential: { bearerToken: string }) => ({
    authorization: `Bearer ${credential.bearerToken}`,
  }))
  const connector = {
    broker: {
      allowedHosts: ['api.x.com'],
      injectedHeaderNames: ['authorization'],
      injectedHeaders,
    },
  } as unknown as NonNullable<ReturnType<typeof getConnector>>
  const toolConfig = {
    _secrets: {
      credentialOverrides: {
        x: {
          encrypted: 'encrypted-token',
          version: 1,
        },
      },
    },
  }
  const sandbox = {}
  mockReadProviderCredential.mockResolvedValue({
    bearerToken: 'override-token',
  })
  mockSandboxCreate.mockResolvedValue(sandbox)

  await expect(
    createBrokerSandbox({
      connector,
      provider: 'x',
      runId: 'run_test',
      toolConfig,
      userId: 'user_test',
    })
  ).resolves.toBe(sandbox)

  expect(mockReadProviderCredential).toHaveBeenCalledWith({
    provider: 'x',
    toolConfig,
    userId: 'user_test',
  })
  expect(injectedHeaders).toHaveBeenCalledWith({
    bearerToken: 'override-token',
  })
  expect(mockSandboxCreate).toHaveBeenCalledWith(
    expect.objectContaining({
      networkPolicy: {
        allow: {
          'api.x.com': [
            {
              transform: [
                {
                  headers: {
                    authorization: 'Bearer override-token',
                  },
                },
              ],
            },
          ],
        },
      },
    })
  )
})
