import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockListWaitlistAdminEmails, mockSendResendReactEmail } = vi.hoisted(
  () => ({
    mockListWaitlistAdminEmails: vi.fn(),
    mockSendResendReactEmail: vi.fn(),
  })
)

vi.mock('server-only', () => ({}))

vi.mock('@outname/shared/waitlist/server/admin-email-config', () => ({
  listWaitlistAdminEmails: mockListWaitlistAdminEmails,
}))

vi.mock('@outname/shared/server/resend', () => ({
  sendResendReactEmail: mockSendResendReactEmail,
}))

vi.mock('@outname/shared/server/email-logo-url', () => ({
  getEmailLogoUrl: () => 'https://outna.me/icon.png',
}))

vi.mock('@outname/shared/server/email-urls', () => ({
  buildEmailWebUrl: (path: string) => `https://outna.me${path}`,
  getEmailAppLoginUrl: () => 'https://app.outna.me/login',
  getEmailWaitlistAdminUrl: () => 'https://app.outna.me/settings/waitlist',
  getEmailWaitlistConfirmationUrl: (token: string) =>
    `https://outna.me/waitlist/confirm?token=${token}`,
}))

vi.mock('@outname/shared/waitlist/server/preference-token', () => ({
  createWaitlistUnsubscribeToken: (email: string) => `token:${email}`,
}))

import { sendProductHuntLaunchIssueAdminNotification } from './email'

const ENV_KEYS = [
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

describe('waitlist admin emails', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv()
    process.env.WAITLIST_FROM_EMAIL = 'OUTNA.ME <waitlist@example.com>'
    process.env.WAITLIST_REPLY_TO = 'reply@example.com'
  })

  afterEach(() => {
    restoreEnv()
  })

  it('sends admin notifications to every user with the admin role', async () => {
    mockListWaitlistAdminEmails.mockResolvedValue([
      'admin-a@example.com',
      'admin-b@example.com',
    ])
    mockSendResendReactEmail
      .mockResolvedValueOnce('email_a')
      .mockResolvedValueOnce('email_b')

    await sendProductHuntLaunchIssueAdminNotification({
      dedupeKey: 'issue-dedupe',
      issues: [
        {
          key: 'product_hunt_social',
          message: 'Social automation failed.',
          severity: 'failure',
        },
      ],
      runAtIso: '2026-06-16T09:00:00.000Z',
    })

    expect(mockSendResendReactEmail).toHaveBeenCalledTimes(2)
    expect(mockSendResendReactEmail).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        from: 'OUTNA.ME <waitlist@example.com>',
        idempotencyKey:
          'product-hunt-launch-issue/issue-dedupe:admin-a%40example.com',
        replyTo: 'reply@example.com',
        subject: 'Product Hunt launch issue: 1 check(s) need attention',
        to: 'admin-a@example.com',
      })
    )
    expect(mockSendResendReactEmail).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        idempotencyKey:
          'product-hunt-launch-issue/issue-dedupe:admin-b%40example.com',
        to: 'admin-b@example.com',
      })
    )
  })

  it('attempts every admin recipient before reporting send failures', async () => {
    mockListWaitlistAdminEmails.mockResolvedValue([
      'admin-a@example.com',
      'admin-b@example.com',
    ])
    mockSendResendReactEmail
      .mockRejectedValueOnce(new Error('first send failed'))
      .mockResolvedValueOnce('email_b')

    await expect(
      sendProductHuntLaunchIssueAdminNotification({
        dedupeKey: 'issue-dedupe',
        issues: [
          {
            key: 'product_hunt_social',
            message: 'Social automation failed.',
            severity: 'failure',
          },
        ],
        runAtIso: '2026-06-16T09:00:00.000Z',
      })
    ).rejects.toThrow('Admin email send failed for 1/2 recipient')

    expect(mockSendResendReactEmail).toHaveBeenCalledTimes(2)
  })

  it('skips admin notifications when there are no admin users', async () => {
    mockListWaitlistAdminEmails.mockResolvedValue([])

    await sendProductHuntLaunchIssueAdminNotification({
      dedupeKey: 'issue-dedupe',
      issues: [
        {
          key: 'product_hunt_social',
          message: 'Social automation failed.',
          severity: 'failure',
        },
      ],
      runAtIso: '2026-06-16T09:00:00.000Z',
    })

    expect(mockSendResendReactEmail).not.toHaveBeenCalled()
  })
})
