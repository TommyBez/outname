import type { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const PRODUCT_HUNT_ISSUE_DEDUPE_KEY_PATTERN =
  /^vercel-day-2026\/\d{4}-\d{2}-\d{2}T\d{2}\/[a-f0-9]{12}$/

const {
  mockConnection,
  mockGetProductHuntLaunchUrlHandoffCandidates,
  mockResolveProductHuntLaunchUrl,
  mockRunProductHuntLaunchAdminDigest,
  mockRunProductHuntLaunchAutomation,
  mockRunProductHuntSocialAutomation,
  mockSendProductHuntLaunchIssueAdminNotification,
  mockWithRedisLock,
} = vi.hoisted(() => ({
  mockConnection: vi.fn(),
  mockGetProductHuntLaunchUrlHandoffCandidates: vi.fn(),
  mockResolveProductHuntLaunchUrl: vi.fn(),
  mockRunProductHuntLaunchAdminDigest: vi.fn(),
  mockRunProductHuntLaunchAutomation: vi.fn(),
  mockRunProductHuntSocialAutomation: vi.fn(),
  mockSendProductHuntLaunchIssueAdminNotification: vi.fn(),
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

vi.mock('@outname/shared/launch/product-hunt-admin-digest', () => ({
  runProductHuntLaunchAdminDigest: mockRunProductHuntLaunchAdminDigest,
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

vi.mock('@outname/shared/launch/product-hunt-url-handoff', () => ({
  getProductHuntLaunchUrlHandoffCandidates:
    mockGetProductHuntLaunchUrlHandoffCandidates,
}))

vi.mock('@outname/shared/waitlist/server/email', () => ({
  sendProductHuntLaunchIssueAdminNotification:
    mockSendProductHuntLaunchIssueAdminNotification,
}))

import { GET } from './route'

const ENV_KEYS = [
  'CRON_SECRET',
  'NEXT_PUBLIC_PRODUCT_HUNT_LAUNCH_URL',
  'PRODUCT_HUNT_LAUNCH_AUTOMATION_ENABLED',
  'PRODUCT_HUNT_LAUNCH_EMAIL_BATCH_SIZE',
  'PRODUCT_HUNT_LAUNCH_URL',
  'PRODUCT_HUNT_LAUNCH_URL_CANDIDATES',
  'PRODUCT_HUNT_SOCIAL_AUTOMATION_ENABLED',
  'PRODUCT_HUNT_SOCIAL_ATTACH_MEDIA',
  'PRODUCT_HUNT_TYPEFULLY_API_KEY',
  'PRODUCT_HUNT_TYPEFULLY_SOCIAL_SET_ID',
  'PRODUCT_HUNT_TYPEFULLY_USER_ID',
  'RESEND_API_KEY',
  'VERCEL',
  'VERCEL_ENV',
  'WAITLIST_FROM_EMAIL',
  'WAITLIST_REPLY_TO',
] as const

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

function createCronRequest(authorization?: string): NextRequest {
  return new Request('http://localhost:3001/api/cron/product-hunt-launch', {
    headers: authorization ? { authorization } : undefined,
  }) as unknown as NextRequest
}

describe('Product Hunt launch cron route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv()
    mockConnection.mockResolvedValue(undefined)
    mockGetProductHuntLaunchUrlHandoffCandidates.mockResolvedValue([])
    mockResolveProductHuntLaunchUrl.mockResolvedValue({
      candidates: [],
      source: 'none',
      url: null,
    })
    mockRunProductHuntLaunchAutomation.mockResolvedValue({
      events: [],
      ok: true,
    })
    mockRunProductHuntLaunchAdminDigest.mockResolvedValue({
      ok: true,
      reason: 'outside_digest_window',
      skipped: true,
    })
    mockRunProductHuntSocialAutomation.mockResolvedValue({
      ok: true,
      posts: [],
    })
    mockSendProductHuntLaunchIssueAdminNotification.mockResolvedValue(undefined)
    process.env.RESEND_API_KEY = 're_test'
    process.env.WAITLIST_FROM_EMAIL = 'OUTNA.ME <waitlist@example.com>'
    process.env.WAITLIST_REPLY_TO = 'reply@example.com'
    mockWithRedisLock.mockImplementation(
      async (
        _key: string,
        _ttlSeconds: number,
        callback: () => Promise<unknown>
      ) => await callback()
    )
  })

  afterEach(() => {
    restoreEnv()
  })

  it('short-circuits preview deployments before Typefully or email automation', async () => {
    process.env.VERCEL = '1'
    process.env.VERCEL_ENV = 'preview'
    delete process.env.CRON_SECRET

    const response = await GET(createCronRequest())

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({
      ok: true,
      readiness: {
        ok: true,
      },
      skipped:
        'product hunt launch external side effects disabled in Vercel preview',
    })
    expect(body.readiness.checks).toContainEqual(
      expect.objectContaining({
        key: 'typefully_delivery',
        message: 'Preview skips Typefully connection lookup and API calls.',
        status: 'ready',
      })
    )
    expect(mockWithRedisLock).not.toHaveBeenCalled()
    expect(mockGetProductHuntLaunchUrlHandoffCandidates).not.toHaveBeenCalled()
    expect(mockResolveProductHuntLaunchUrl).not.toHaveBeenCalled()
    expect(mockRunProductHuntLaunchAdminDigest).not.toHaveBeenCalled()
    expect(mockRunProductHuntLaunchAutomation).not.toHaveBeenCalled()
    expect(mockRunProductHuntSocialAutomation).not.toHaveBeenCalled()
    expect(
      mockSendProductHuntLaunchIssueAdminNotification
    ).not.toHaveBeenCalled()
  })

  it('requires a cron secret outside preview deployments', async () => {
    process.env.VERCEL = '1'
    process.env.VERCEL_ENV = 'production'
    delete process.env.CRON_SECRET

    const response = await GET(createCronRequest())

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body).toMatchObject({
      error: 'cron secret not set',
      readiness: {
        ok: false,
      },
    })
    expect(body.readiness.checks).toContainEqual(
      expect.objectContaining({
        key: 'cron_secret',
        status: 'blocked',
      })
    )
    expect(mockWithRedisLock).not.toHaveBeenCalled()
    expect(mockGetProductHuntLaunchUrlHandoffCandidates).not.toHaveBeenCalled()
    expect(mockResolveProductHuntLaunchUrl).not.toHaveBeenCalled()
    expect(mockRunProductHuntLaunchAdminDigest).not.toHaveBeenCalled()
    expect(mockRunProductHuntLaunchAutomation).not.toHaveBeenCalled()
    expect(mockRunProductHuntSocialAutomation).not.toHaveBeenCalled()
  })

  it('rejects unauthorized non-preview requests before launch automation runs', async () => {
    process.env.CRON_SECRET = 'expected-secret'
    process.env.VERCEL = '1'
    process.env.VERCEL_ENV = 'production'

    const response = await GET(createCronRequest('Bearer wrong-secret'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' })
    expect(mockWithRedisLock).not.toHaveBeenCalled()
    expect(mockGetProductHuntLaunchUrlHandoffCandidates).not.toHaveBeenCalled()
    expect(mockResolveProductHuntLaunchUrl).not.toHaveBeenCalled()
    expect(mockRunProductHuntLaunchAdminDigest).not.toHaveBeenCalled()
    expect(mockRunProductHuntLaunchAutomation).not.toHaveBeenCalled()
    expect(mockRunProductHuntSocialAutomation).not.toHaveBeenCalled()
  })

  it('can disable Typefully social automation outside preview without disabling email automation', async () => {
    process.env.CRON_SECRET = 'expected-secret'
    process.env.PRODUCT_HUNT_SOCIAL_AUTOMATION_ENABLED = 'false'
    process.env.VERCEL = '1'
    process.env.VERCEL_ENV = 'production'

    const response = await GET(createCronRequest('Bearer expected-secret'))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({
      email: {
        events: [],
        ok: true,
      },
      ok: true,
      productHuntUrl: {
        candidates: [],
        source: 'none',
        url: null,
      },
      readiness: {
        ok: true,
      },
      social: {
        ok: true,
        skipped: 'product hunt social automation disabled',
      },
    })
    expect(mockRunProductHuntLaunchAutomation).toHaveBeenCalledWith({
      batchSize: 50,
      productHuntUrl: null,
    })
    expect(mockRunProductHuntLaunchAdminDigest).toHaveBeenCalledWith({
      email: {
        events: [],
        ok: true,
      },
      issues: [],
      now: expect.any(Date),
      productHuntUrl: null,
      productHuntUrlSource: 'none',
      social: {
        ok: true,
        skipped: 'product hunt social automation disabled',
      },
    })
    expect(mockResolveProductHuntLaunchUrl).toHaveBeenCalledWith({
      candidateUrls: undefined,
      explicitUrl: null,
      handoffUrls: [],
      publicUrl: null,
    })
    expect(mockRunProductHuntSocialAutomation).not.toHaveBeenCalled()
    expect(
      mockSendProductHuntLaunchIssueAdminNotification
    ).not.toHaveBeenCalled()
  })

  it('uses Product Hunt referrer handoffs as verified URL candidates', async () => {
    process.env.CRON_SECRET = 'expected-secret'
    process.env.VERCEL = '1'
    process.env.VERCEL_ENV = 'production'
    mockGetProductHuntLaunchUrlHandoffCandidates.mockResolvedValue([
      'https://www.producthunt.com/posts/custom-outname',
    ])
    mockResolveProductHuntLaunchUrl.mockResolvedValue({
      candidates: [
        {
          ok: true,
          status: 200,
          url: 'https://www.producthunt.com/posts/custom-outname',
        },
      ],
      source: 'handoff',
      url: 'https://www.producthunt.com/posts/custom-outname',
    })

    const response = await GET(createCronRequest('Bearer expected-secret'))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({
      ok: true,
      productHuntUrl: {
        candidates: [
          {
            ok: true,
            status: 200,
            url: 'https://www.producthunt.com/posts/custom-outname',
          },
        ],
        source: 'handoff',
        url: 'https://www.producthunt.com/posts/custom-outname',
      },
    })
    expect(mockResolveProductHuntLaunchUrl).toHaveBeenCalledWith({
      candidateUrls: undefined,
      explicitUrl: null,
      handoffUrls: ['https://www.producthunt.com/posts/custom-outname'],
      publicUrl: null,
    })
    expect(mockRunProductHuntLaunchAutomation).toHaveBeenCalledWith({
      batchSize: 50,
      productHuntUrl: 'https://www.producthunt.com/posts/custom-outname',
    })
    expect(mockRunProductHuntSocialAutomation).toHaveBeenCalledWith({
      apiKey: null,
      productHuntUrl: 'https://www.producthunt.com/posts/custom-outname',
      socialSetId: null,
      typefullyUserId: null,
    })
  })

  it('does not read Product Hunt referrer handoffs when an explicit URL is configured', async () => {
    process.env.CRON_SECRET = 'expected-secret'
    process.env.PRODUCT_HUNT_LAUNCH_URL =
      'https://www.producthunt.com/posts/outna-me'
    process.env.VERCEL = '1'
    process.env.VERCEL_ENV = 'production'
    mockResolveProductHuntLaunchUrl.mockResolvedValue({
      candidates: [],
      source: 'env',
      url: 'https://www.producthunt.com/posts/outna-me',
    })

    const response = await GET(createCronRequest('Bearer expected-secret'))

    expect(response.status).toBe(200)
    expect(mockGetProductHuntLaunchUrlHandoffCandidates).not.toHaveBeenCalled()
    expect(mockResolveProductHuntLaunchUrl).toHaveBeenCalledWith({
      candidateUrls: undefined,
      explicitUrl: 'https://www.producthunt.com/posts/outna-me',
      handoffUrls: [],
      publicUrl: null,
    })
  })

  it('continues launch automation and alerts when Product Hunt URL handoff lookup fails', async () => {
    process.env.CRON_SECRET = 'expected-secret'
    process.env.VERCEL = '1'
    process.env.VERCEL_ENV = 'production'
    mockGetProductHuntLaunchUrlHandoffCandidates.mockRejectedValue(
      new Error('launch_feedback table missing')
    )

    const response = await GET(createCronRequest('Bearer expected-secret'))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({
      issues: [
        {
          details: ['launch_feedback table missing'],
          key: 'product_hunt_url_handoff',
          message:
            'Product Hunt URL handoff lookup failed before URL discovery completed.',
          severity: 'warning',
        },
      ],
      ok: true,
    })
    expect(mockResolveProductHuntLaunchUrl).toHaveBeenCalledWith({
      candidateUrls: undefined,
      explicitUrl: null,
      handoffUrls: [],
      publicUrl: null,
    })
    expect(mockRunProductHuntLaunchAutomation).toHaveBeenCalledWith({
      batchSize: 50,
      productHuntUrl: null,
    })
    expect(mockRunProductHuntSocialAutomation).toHaveBeenCalledWith({
      apiKey: null,
      productHuntUrl: null,
      socialSetId: null,
      typefullyUserId: null,
    })
    expect(
      mockSendProductHuntLaunchIssueAdminNotification
    ).toHaveBeenCalledWith({
      dedupeKey: expect.stringMatching(PRODUCT_HUNT_ISSUE_DEDUPE_KEY_PATTERN),
      issues: [
        {
          details: ['launch_feedback table missing'],
          key: 'product_hunt_url_handoff',
          message:
            'Product Hunt URL handoff lookup failed before URL discovery completed.',
          severity: 'warning',
        },
      ],
      runAtIso: expect.any(String),
    })
  })

  it('keeps launch delivery running when the admin digest fails', async () => {
    process.env.CRON_SECRET = 'expected-secret'
    process.env.VERCEL = '1'
    process.env.VERCEL_ENV = 'production'
    mockRunProductHuntLaunchAdminDigest.mockRejectedValue(
      new Error('digest down')
    )

    const response = await GET(createCronRequest('Bearer expected-secret'))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({
      adminDigest: {
        error: 'digest down',
        ok: false,
      },
      issues: [
        {
          details: ['digest down'],
          key: 'product_hunt_admin_digest',
          message: 'Product Hunt admin digest failed before completing.',
          severity: 'warning',
        },
      ],
      ok: true,
    })
    expect(mockRunProductHuntLaunchAutomation).toHaveBeenCalledTimes(1)
    expect(mockRunProductHuntSocialAutomation).toHaveBeenCalledTimes(1)
    expect(
      mockSendProductHuntLaunchIssueAdminNotification
    ).toHaveBeenCalledWith({
      dedupeKey: expect.stringMatching(PRODUCT_HUNT_ISSUE_DEDUPE_KEY_PATTERN),
      issues: [
        {
          details: ['digest down'],
          key: 'product_hunt_admin_digest',
          message: 'Product Hunt admin digest failed before completing.',
          severity: 'warning',
        },
      ],
      runAtIso: expect.any(String),
    })
  })

  it('keeps Typefully social automation isolated when email automation fails', async () => {
    process.env.CRON_SECRET = 'expected-secret'
    process.env.PRODUCT_HUNT_TYPEFULLY_API_KEY = 'tf_launch_key'
    process.env.PRODUCT_HUNT_TYPEFULLY_SOCIAL_SET_ID = 'social-set-1'
    process.env.VERCEL = '1'
    process.env.VERCEL_ENV = 'production'
    mockRunProductHuntLaunchAutomation.mockRejectedValue(
      new Error('email down')
    )
    mockRunProductHuntSocialAutomation.mockResolvedValue({
      ok: true,
      posts: [
        {
          id: 'launch-day-linkedin',
          reason: 'schedule_window_not_open',
          skipped: true,
        },
      ],
    })

    const response = await GET(createCronRequest('Bearer expected-secret'))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({
      email: {
        error: 'email down',
        ok: false,
      },
      ok: true,
      productHuntUrl: {
        candidates: [],
        source: 'none',
        url: null,
      },
      readiness: {
        ok: true,
      },
      social: {
        ok: true,
        posts: [
          {
            id: 'launch-day-linkedin',
            reason: 'schedule_window_not_open',
            skipped: true,
          },
        ],
      },
    })
    expect(mockRunProductHuntSocialAutomation).toHaveBeenCalledWith({
      apiKey: 'tf_launch_key',
      productHuntUrl: null,
      socialSetId: 'social-set-1',
      typefullyUserId: null,
    })
  })

  it('keeps email automation isolated when Typefully social automation fails', async () => {
    process.env.CRON_SECRET = 'expected-secret'
    process.env.PRODUCT_HUNT_TYPEFULLY_API_KEY = 'tf_launch_key'
    process.env.PRODUCT_HUNT_TYPEFULLY_SOCIAL_SET_ID = 'social-set-1'
    process.env.VERCEL = '1'
    process.env.VERCEL_ENV = 'production'
    mockRunProductHuntLaunchAutomation.mockResolvedValue({
      events: [
        {
          count: 1,
          eventType: 'launch_live',
        },
      ],
      ok: true,
    })
    mockRunProductHuntSocialAutomation.mockRejectedValue(
      new Error('typefully down')
    )
    mockSendProductHuntLaunchIssueAdminNotification.mockRejectedValue(
      new Error('notification down')
    )

    const response = await GET(createCronRequest('Bearer expected-secret'))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({
      email: {
        events: [
          {
            count: 1,
            eventType: 'launch_live',
          },
        ],
        ok: true,
      },
      issues: [
        {
          details: ['typefully down'],
          key: 'product_hunt_social_section',
          message: 'Product Hunt social automation failed before completing.',
          severity: 'failure',
        },
      ],
      ok: true,
      productHuntUrl: {
        candidates: [],
        source: 'none',
        url: null,
      },
      readiness: {
        ok: true,
      },
      social: {
        error: 'typefully down',
        ok: false,
      },
    })
    expect(mockRunProductHuntLaunchAutomation).toHaveBeenCalledTimes(1)
    expect(
      mockSendProductHuntLaunchIssueAdminNotification
    ).toHaveBeenCalledWith({
      dedupeKey: expect.stringMatching(PRODUCT_HUNT_ISSUE_DEDUPE_KEY_PATTERN),
      issues: [
        {
          details: ['typefully down'],
          key: 'product_hunt_social_section',
          message: 'Product Hunt social automation failed before completing.',
          severity: 'failure',
        },
      ],
      runAtIso: expect.any(String),
    })
  })
})
