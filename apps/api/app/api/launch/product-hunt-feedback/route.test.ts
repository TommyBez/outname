import type { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const FEEDBACK_ID_PATTERN = /^lfbk_/

const {
  mockAfter,
  mockConnection,
  mockDbInsert,
  mockDbInsertValues,
  mockDenyIfBot,
  mockSendProductHuntFeedbackAdminNotification,
} = vi.hoisted(() => ({
  mockAfter: vi.fn(async (callback: () => Promise<void>) => {
    await callback()
  }),
  mockConnection: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbInsertValues: vi.fn(),
  mockDenyIfBot: vi.fn(),
  mockSendProductHuntFeedbackAdminNotification: vi.fn(),
}))

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()

  return {
    ...actual,
    after: mockAfter,
    connection: mockConnection,
  }
})

vi.mock('@outname/db', () => ({
  db: {
    insert: mockDbInsert,
  },
}))

vi.mock('@outname/db/schema', () => ({
  launchFeedback: {},
}))

vi.mock('@outname/shared/server/botid-guard', () => ({
  denyIfBot: mockDenyIfBot,
}))

vi.mock('@outname/shared/waitlist/server/email', () => ({
  sendProductHuntFeedbackAdminNotification:
    mockSendProductHuntFeedbackAdminNotification,
}))

import { POST } from './route'

const ENV_KEYS = [
  'KV_REST_API_TOKEN',
  'KV_REST_API_URL',
  'VERCEL',
  'VERCEL_ENV',
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

function createFeedbackRequest(body: unknown): NextRequest {
  return new Request('http://localhost:3001/api/launch/product-hunt-feedback', {
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
      'user-agent': 'vitest-product-hunt-feedback',
      'x-forwarded-for': '203.0.113.10',
    },
    method: 'POST',
  }) as unknown as NextRequest
}

async function readJson(response: Response) {
  return (await response.json()) as unknown
}

describe('Product Hunt feedback route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv()
    mockConnection.mockResolvedValue(undefined)
    mockDbInsert.mockReturnValue({ values: mockDbInsertValues })
    mockDbInsertValues.mockResolvedValue(undefined)
    mockDenyIfBot.mockResolvedValue(null)
    mockSendProductHuntFeedbackAdminNotification.mockResolvedValue('email_123')
    delete process.env.KV_REST_API_TOKEN
    delete process.env.KV_REST_API_URL
  })

  afterEach(() => {
    restoreEnv()
  })

  it('stores valid preview feedback without bot checks or admin email side effects', async () => {
    process.env.VERCEL = '1'
    process.env.VERCEL_ENV = 'preview'

    const response = await POST(
      createFeedbackRequest({
        email: 'maker@example.com',
        feedbackType: 'positioning',
        message: 'The launch positioning is clear, but I want more examples.',
        referrer: 'https://www.producthunt.com/posts/outna-me',
        source: 'product-hunt-landing',
        utmCampaign: 'vercel-day-2026',
        utmContent: 'preview-smoke',
        utmMedium: 'launch',
        utmSource: 'producthunt',
      })
    )

    expect(response.status).toBe(200)
    expect(await readJson(response)).toEqual({
      message: 'Feedback received. Thank you.',
      ok: true,
    })
    expect(mockDenyIfBot).not.toHaveBeenCalled()
    expect(mockDbInsert).toHaveBeenCalledTimes(1)
    expect(mockDbInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'maker@example.com',
        feedbackType: 'positioning',
        launchKey: 'vercel-day-2026',
        message: 'The launch positioning is clear, but I want more examples.',
        referrer: 'https://www.producthunt.com/posts/outna-me',
        source: 'product-hunt-landing',
        userAgent: 'vitest-product-hunt-feedback',
        utmCampaign: 'vercel-day-2026',
        utmContent: 'preview-smoke',
        utmMedium: 'launch',
        utmSource: 'producthunt',
      })
    )
    expect(mockDbInsertValues.mock.calls[0]?.[0].id).toMatch(
      FEEDBACK_ID_PATTERN
    )
    expect(mockAfter).not.toHaveBeenCalled()
    expect(mockSendProductHuntFeedbackAdminNotification).not.toHaveBeenCalled()
  })

  it('sends an admin notification after valid production feedback is stored', async () => {
    process.env.VERCEL = '1'
    process.env.VERCEL_ENV = 'production'

    const response = await POST(
      createFeedbackRequest({
        email: '',
        feedbackType: 'first-agent',
        message:
          'I would trust a narrow reporting agent first, then expand scope later.',
        source: 'product-hunt-landing',
      })
    )

    expect(response.status).toBe(200)
    expect(mockDenyIfBot).toHaveBeenCalledTimes(1)
    expect(mockDbInsertValues).toHaveBeenCalledTimes(1)
    expect(mockAfter).toHaveBeenCalledTimes(1)
    expect(mockSendProductHuntFeedbackAdminNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        email: null,
        feedbackType: 'first-agent',
        message:
          'I would trust a narrow reporting agent first, then expand scope later.',
        source: 'product-hunt-landing',
      })
    )
  })

  it('returns generic success for honeypot submissions without storing feedback', async () => {
    process.env.VERCEL = '1'
    process.env.VERCEL_ENV = 'preview'

    const response = await POST(
      createFeedbackRequest({
        company: 'Spam Co',
        feedbackType: 'other',
        message: 'This message is long enough to pass validation.',
      })
    )

    expect(response.status).toBe(200)
    expect(await readJson(response)).toEqual({
      message: 'Feedback received. Thank you.',
      ok: true,
    })
    expect(mockDbInsert).not.toHaveBeenCalled()
    expect(mockAfter).not.toHaveBeenCalled()
    expect(mockSendProductHuntFeedbackAdminNotification).not.toHaveBeenCalled()
  })

  it('rejects invalid feedback before inserting', async () => {
    process.env.VERCEL = '1'
    process.env.VERCEL_ENV = 'preview'

    const response = await POST(
      createFeedbackRequest({
        feedbackType: 'positioning',
        message: 'too short',
      })
    )

    expect(response.status).toBe(400)
    expect(await readJson(response)).toEqual({ error: 'invalid payload' })
    expect(mockDbInsert).not.toHaveBeenCalled()
    expect(mockAfter).not.toHaveBeenCalled()
  })
})
