import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockDbInsert, mockDbSelect, mockSendDigest } = vi.hoisted(() => ({
  mockDbInsert: vi.fn(),
  mockDbSelect: vi.fn(),
  mockSendDigest: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@outname/db', () => ({
  db: {
    insert: mockDbInsert,
    select: mockDbSelect,
  },
}))

vi.mock('@outname/shared/waitlist/server/email', () => ({
  sendProductHuntLaunchDigestAdminNotification: mockSendDigest,
}))

import {
  getProductHuntAdminDigestEvent,
  runProductHuntLaunchAdminDigest,
} from './product-hunt-admin-digest'

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

describe('Product Hunt admin digest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv()
  })

  afterEach(() => {
    restoreEnv()
  })

  it('detects digest windows for launch checkpoints', () => {
    expect(
      getProductHuntAdminDigestEvent(new Date('2026-06-16T07:45:00.000Z'))
    )?.toMatchObject({
      key: 'launch-day-start',
      label: 'Launch day first checkpoint',
    })
    expect(
      getProductHuntAdminDigestEvent(new Date('2026-06-16T17:00:00.000Z'))
    ).toBeNull()
  })

  it('skips before DB or Resend access in Vercel preview', async () => {
    process.env.VERCEL = '1'
    process.env.VERCEL_ENV = 'preview'

    await expect(
      runProductHuntLaunchAdminDigest({
        email: { events: [], ok: true },
        issues: [],
        now: new Date('2026-06-16T07:45:00.000Z'),
        productHuntUrl: null,
        productHuntUrlSource: 'none',
        social: { ok: true, posts: [] },
      })
    ).resolves.toEqual({
      ok: true,
      reason: 'preview_external_side_effects_disabled',
      skipped: true,
    })
    expect(mockDbSelect).not.toHaveBeenCalled()
    expect(mockDbInsert).not.toHaveBeenCalled()
    expect(mockSendDigest).not.toHaveBeenCalled()
  })

  it('does not query DB outside digest windows', async () => {
    await expect(
      runProductHuntLaunchAdminDigest({
        email: { events: [], ok: true },
        issues: [],
        now: new Date('2026-06-16T17:00:00.000Z'),
        productHuntUrl: null,
        productHuntUrlSource: 'none',
        social: { ok: true, posts: [] },
      })
    ).resolves.toEqual({
      ok: true,
      reason: 'outside_digest_window',
      skipped: true,
    })
    expect(mockDbSelect).not.toHaveBeenCalled()
    expect(mockDbInsert).not.toHaveBeenCalled()
    expect(mockSendDigest).not.toHaveBeenCalled()
  })
})
