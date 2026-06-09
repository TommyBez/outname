import { afterEach, beforeEach, expect, test, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  buildEmailAppUrl,
  buildEmailWebUrl,
  getEmailAppLoginUrl,
  getEmailAppOrigin,
  getEmailWaitlistAdminUrl,
  getEmailWaitlistConfirmationUrl,
  getEmailWebOrigin,
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

const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL
const originalWebUrl = process.env.NEXT_PUBLIC_WEB_URL

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_APP_URL
  delete process.env.NEXT_PUBLIC_WEB_URL
})

afterEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = originalAppUrl
  process.env.NEXT_PUBLIC_WEB_URL = originalWebUrl
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

test('prefers NEXT_PUBLIC_APP_URL over related-project resolution', () => {
  process.env.NEXT_PUBLIC_APP_URL = 'https://app.outna.me/'
  expect(getEmailAppOrigin()).toBe('https://app.outna.me')
  expect(getEmailAppLoginUrl()).toBe('https://app.outna.me/login')
})

test('prefers NEXT_PUBLIC_WEB_URL over related-project resolution', () => {
  process.env.NEXT_PUBLIC_WEB_URL = 'https://outna.me'
  expect(getEmailWebOrigin()).toBe('https://outna.me')
  expect(getEmailWaitlistConfirmationUrl('abc123')).toBe(
    'https://outna.me/waitlist/confirm?token=abc123'
  )
})

test('ignores blank or invalid NEXT_PUBLIC_* URLs', () => {
  process.env.NEXT_PUBLIC_APP_URL = '   '
  process.env.NEXT_PUBLIC_WEB_URL = 'not-a-url'
  expect(getEmailAppOrigin()).toBe('https://app.example.com')
  expect(getEmailWebOrigin()).toBe('https://web.example.com')
})
