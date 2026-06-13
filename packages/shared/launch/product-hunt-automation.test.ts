import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockDbInsert, mockDbSelect, mockSendProductHuntLaunchEmail } =
  vi.hoisted(() => ({
    mockDbInsert: vi.fn(),
    mockDbSelect: vi.fn(),
    mockSendProductHuntLaunchEmail: vi.fn(),
  }))

vi.mock('server-only', () => ({}))

vi.mock('@outname/db', () => ({
  db: {
    insert: mockDbInsert,
    select: mockDbSelect,
  },
}))

vi.mock('@outname/db/schema', () => ({
  waitlistEntry: {
    email: 'email',
    id: 'id',
    status: 'status',
  },
  waitlistLaunchEmailDelivery: {
    eventKey: 'eventKey',
    id: 'id',
    waitlistEntryId: 'waitlistEntryId',
  },
}))

vi.mock('@outname/shared/waitlist/server/email', () => ({
  sendProductHuntLaunchEmail: mockSendProductHuntLaunchEmail,
}))

import { productHuntEmailEvents } from './product-hunt'
import { runProductHuntLaunchAutomation } from './product-hunt-automation'

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

describe('Product Hunt launch email automation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv()
  })

  afterEach(() => {
    restoreEnv()
  })

  it('skips before DB or email delivery access in Vercel preview', async () => {
    process.env.VERCEL = '1'
    process.env.VERCEL_ENV = 'preview'

    const result = await runProductHuntLaunchAutomation({
      batchSize: 50,
      productHuntUrl: null,
    })

    expect(result).toEqual({
      events: productHuntEmailEvents.map((event) => ({
        eventKey: event.key,
        failed: 0,
        reason: 'preview_external_side_effects_disabled',
        sent: 0,
        skipped: true,
      })),
      ok: true,
    })
    expect(mockDbSelect).not.toHaveBeenCalled()
    expect(mockDbInsert).not.toHaveBeenCalled()
    expect(mockSendProductHuntLaunchEmail).not.toHaveBeenCalled()
  })
})
