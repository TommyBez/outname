import { afterEach, expect, test, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  buildEmailAppUrl,
  buildEmailWebUrl,
  getEmailAppLoginUrl,
  getEmailWaitlistAdminUrl,
  getEmailWaitlistConfirmationUrl,
} from './email-urls'

vi.mock('@vercel/related-projects', () => ({
  withRelatedProject: ({
    defaultHost,
    projectName,
  }: {
    defaultHost: string
    projectName: string
  }) => {
    if (projectName === 'outname-app') {
      return 'https://app.example.com'
    }
    if (projectName === 'outname') {
      return 'https://web.example.com'
    }
    return defaultHost
  },
}))

afterEach(() => {
  vi.clearAllMocks()
})

test('builds app login URL on the app origin', () => {
  expect(getEmailAppLoginUrl()).toBe('https://app.example.com/login')
})

test('builds waitlist confirmation URL on the web origin', () => {
  expect(getEmailWaitlistConfirmationUrl('abc123')).toBe(
    'https://web.example.com/waitlist/confirm?token=abc123'
  )
})

test('builds waitlist admin URL on the app origin', () => {
  expect(getEmailWaitlistAdminUrl()).toBe(
    'https://app.example.com/settings/waitlist'
  )
})

test('normalizes paths without a leading slash', () => {
  expect(buildEmailAppUrl('login')).toBe('https://app.example.com/login')
  expect(buildEmailWebUrl('waitlist')).toBe('https://web.example.com/waitlist')
})
