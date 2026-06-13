import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockDbFrom,
  mockDbInsert,
  mockDbInsertValues,
  mockDbLimit,
  mockDbSelect,
  mockDbWhere,
  mockFetch,
  mockOnConflictDoNothing,
  mockReadConnectorCredential,
} = vi.hoisted(() => ({
  mockDbFrom: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbInsertValues: vi.fn(),
  mockDbLimit: vi.fn(),
  mockDbSelect: vi.fn(),
  mockDbWhere: vi.fn(),
  mockFetch: vi.fn(),
  mockOnConflictDoNothing: vi.fn(),
  mockReadConnectorCredential: vi.fn(),
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
  readConnectorCredential: mockReadConnectorCredential,
}))

import { PRODUCT_HUNT_SOCIAL_POSTS } from './product-hunt-social'
import { runProductHuntSocialAutomation } from './product-hunt-social-automation'

const ENV_KEYS = ['VERCEL', 'VERCEL_ENV'] as const
const PRODUCT_HUNT_URL = 'https://www.producthunt.com/posts/outna-me'

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
    mockDbSelect.mockReturnValue({ from: mockDbFrom })
    mockDbFrom.mockReturnValue({ where: mockDbWhere })
    mockDbWhere.mockReturnValue({ limit: mockDbLimit })
    mockDbLimit.mockResolvedValue([])
    mockDbInsert.mockReturnValue({ values: mockDbInsertValues })
    mockDbInsertValues.mockReturnValue({
      onConflictDoNothing: mockOnConflictDoNothing,
    })
    mockOnConflictDoNothing.mockResolvedValue(undefined)
    mockReadConnectorCredential.mockResolvedValue({
      credential: { apiKey: 'tf_stored_key' },
    })
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

  it('does not fall back to the first stored Typefully account when config is missing', async () => {
    const result = await runProductHuntSocialAutomation({
      productHuntUrl: PRODUCT_HUNT_URL,
    })

    expect(result).toEqual({
      ok: true,
      posts: PRODUCT_HUNT_SOCIAL_POSTS.map((post) => ({
        postId: post.id,
        reason: 'typefully_configuration_missing',
        skipped: true,
      })),
    })
    expect(mockDbSelect).not.toHaveBeenCalled()
    expect(mockReadConnectorCredential).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('uses an explicit Typefully API key without reading stored connections', async () => {
    mockFetch
      .mockResolvedValueOnce({
        json: async () => ({ results: [{ id: 123, name: 'Launch' }] }),
        ok: true,
      })
      .mockResolvedValue({
        json: async () => ({ results: [] }),
        ok: true,
      })

    const result = await runProductHuntSocialAutomation({
      apiKey: 'tf_env_key',
      productHuntUrl: null,
      socialSetId: '123',
    })

    expect(result.ok).toBe(true)
    expect(mockDbSelect).toHaveBeenCalled()
    expect(mockReadConnectorCredential).not.toHaveBeenCalled()
    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/v2/social-sets/123/drafts',
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: 'Bearer tf_env_key',
        }),
      })
    )
  })

  it('only reads a stored Typefully connection for an explicit user id', async () => {
    mockDbLimit.mockResolvedValueOnce([{ userId: 'user-1' }])
    mockFetch.mockResolvedValue({
      json: async () => ({ results: [] }),
      ok: true,
    })

    const result = await runProductHuntSocialAutomation({
      productHuntUrl: null,
      socialSetId: '123',
      typefullyUserId: 'user-1',
    })

    expect(result.ok).toBe(true)
    expect(mockReadConnectorCredential).toHaveBeenCalledWith({
      connectorId: 'typefully.api_key',
      userId: 'user-1',
    })
  })

  it('skips when an API key can access multiple social sets and no social set is configured', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        results: [
          { id: 123, name: 'Primary' },
          { id: 456, name: 'Other' },
        ],
      }),
      ok: true,
    })

    const result = await runProductHuntSocialAutomation({
      apiKey: 'tf_env_key',
      productHuntUrl: PRODUCT_HUNT_URL,
    })

    expect(result).toEqual({
      ok: true,
      posts: PRODUCT_HUNT_SOCIAL_POSTS.map((post) => ({
        error:
          'Multiple Typefully social sets are available. Configure PRODUCT_HUNT_TYPEFULLY_SOCIAL_SET_ID before running launch social automation.',
        postId: post.id,
        reason: 'typefully_setup_failed',
        skipped: true,
      })),
    })
  })
})
