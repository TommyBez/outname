import type { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockConnection,
  mockResolveProductHuntLaunchUrl,
  mockRunProductHuntLaunchAutomation,
  mockRunProductHuntSocialAutomation,
  mockWithRedisLock,
} = vi.hoisted(() => ({
  mockConnection: vi.fn(),
  mockResolveProductHuntLaunchUrl: vi.fn(),
  mockRunProductHuntLaunchAutomation: vi.fn(),
  mockRunProductHuntSocialAutomation: vi.fn(),
  mockWithRedisLock: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()

  return {
    ...actual,
    connection: mockConnection,
  }
})

vi.mock('@outname/ai/agent-runtime/server/redis-lock', () => ({
  withRedisLock: mockWithRedisLock,
}))

vi.mock('@outname/shared/launch/product-hunt-automation', () => ({
  runProductHuntLaunchAutomation: mockRunProductHuntLaunchAutomation,
}))

vi.mock('@outname/shared/launch/product-hunt-social-automation', () => ({
  runProductHuntSocialAutomation: mockRunProductHuntSocialAutomation,
}))

vi.mock('@outname/shared/launch/product-hunt-url-discovery', () => ({
  resolveProductHuntLaunchUrl: mockResolveProductHuntLaunchUrl,
}))

import { GET } from './route'

const ENV_KEYS = ['CRON_SECRET', 'VERCEL', 'VERCEL_ENV'] as const

const originalEnv = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]])
) as Record<(typeof ENV_KEYS)[number], string | undefined>

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key]
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

describe('Product Hunt launch cron route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv()
    mockConnection.mockResolvedValue(undefined)
  })

  afterEach(() => {
    restoreEnv()
  })

  it('short-circuits preview deployments before Typefully or email automation', async () => {
    process.env.VERCEL = '1'
    process.env.VERCEL_ENV = 'preview'
    delete process.env.CRON_SECRET

    const request = new Request(
      'http://localhost:3001/api/cron/product-hunt-launch'
    ) as unknown as NextRequest

    const response = await GET(request)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      skipped:
        'product hunt launch external side effects disabled in Vercel preview',
    })
    expect(mockWithRedisLock).not.toHaveBeenCalled()
    expect(mockResolveProductHuntLaunchUrl).not.toHaveBeenCalled()
    expect(mockRunProductHuntLaunchAutomation).not.toHaveBeenCalled()
    expect(mockRunProductHuntSocialAutomation).not.toHaveBeenCalled()
  })
})
