import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockDbInsert, mockDbSelect, mockFetch } = vi.hoisted(() => ({
  mockDbInsert: vi.fn(),
  mockDbSelect: vi.fn(),
  mockFetch: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@outname/db', () => ({
  db: {
    insert: mockDbInsert,
    select: mockDbSelect,
  },
}))

vi.mock('@outname/db/schema', () => ({
  launchSocialPostDelivery: {
    connectorId: 'connectorId',
    id: 'id',
    launchKey: 'launchKey',
    platform: 'platform',
    postId: 'postId',
    scheduledAt: 'scheduledAt',
    socialSetId: 'socialSetId',
    typefullyDraftId: 'typefullyDraftId',
  },
  userConnections: {
    connectorId: 'connectorId',
    status: 'status',
    userId: 'userId',
  },
}))

vi.mock('@outname/shared/connections/runtime/credential', () => ({
  readConnectorCredential: vi.fn(),
}))

import { PRODUCT_HUNT_SOCIAL_POSTS } from './product-hunt-social'
import { runProductHuntSocialAutomation } from './product-hunt-social-automation'

const ENV_KEYS = ['VERCEL', 'VERCEL_ENV'] as const

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

describe('Product Hunt social automation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv()
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    restoreEnv()
    vi.unstubAllGlobals()
  })

  it('skips before DB or Typefully access in Vercel preview', async () => {
    process.env.VERCEL = '1'
    process.env.VERCEL_ENV = 'preview'

    const result = await runProductHuntSocialAutomation({
      productHuntUrl: null,
    })

    expect(result).toEqual({
      ok: true,
      posts: PRODUCT_HUNT_SOCIAL_POSTS.map((post) => ({
        postId: post.id,
        reason: 'preview_external_side_effects_disabled',
        skipped: true,
      })),
    })
    expect(mockDbSelect).not.toHaveBeenCalled()
    expect(mockDbInsert).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
