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

const relatedHosts: Record<string, string | undefined> = {}

vi.mock('@vercel/related-projects', () => ({
  withRelatedProject: ({
    defaultHost,
    projectName,
  }: {
    defaultHost: string
    projectName: string
  }) => relatedHosts[projectName] ?? defaultHost,
}))

const ENV_VARS = [
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_WEB_URL',
  'VERCEL_ENV',
  'VERCEL_PROJECT_PRODUCTION_URL',
  'VERCEL_URL',
] as const

const originalEnv = Object.fromEntries(
  ENV_VARS.map((name) => [name, process.env[name]])
)

beforeEach(() => {
  relatedHosts['outname-app'] = 'https://app.example.com'
  relatedHosts.outname = 'https://web.example.com'
  for (const name of ENV_VARS) {
    delete process.env[name]
  }
})

afterEach(() => {
  for (const name of ENV_VARS) {
    const value = originalEnv[name]
    if (value === undefined) {
      delete process.env[name]
    } else {
      process.env[name] = value
    }
  }
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

test('prefers related-project resolution over NEXT_PUBLIC_* values', () => {
  process.env.NEXT_PUBLIC_APP_URL = 'https://stale.example.com'
  expect(getEmailAppOrigin()).toBe('https://app.example.com')
})

test('resolves the current project via NEXT_PUBLIC_* on a related miss', () => {
  relatedHosts['outname-app'] = undefined
  process.env.NEXT_PUBLIC_APP_URL = 'https://app.outna.me/'
  expect(getEmailAppOrigin()).toBe('https://app.outna.me')
  expect(getEmailAppLoginUrl()).toBe('https://app.outna.me/login')
})

test('does not emit the sender origin when a cross-project link is missing', () => {
  // Email sent from the api project without outname-app configured as a
  // related project: the build-time value must win over the api's own
  // system env vars, so links never point at the api host.
  relatedHosts['outname-app'] = undefined
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
  process.env.VERCEL_ENV = 'production'
  process.env.VERCEL_PROJECT_PRODUCTION_URL = 'api.outna.me'
  expect(getEmailAppOrigin()).toBe('http://localhost:3000')
})

test('resolves the current project via system env vars in production', () => {
  relatedHosts['outname-app'] = undefined
  process.env.VERCEL_ENV = 'production'
  process.env.VERCEL_PROJECT_PRODUCTION_URL = 'app.outna.me'
  expect(getEmailAppOrigin()).toBe('https://app.outna.me')
  expect(getEmailAppLoginUrl()).toBe('https://app.outna.me/login')
})

test('resolves the current project via VERCEL_URL in preview', () => {
  relatedHosts.outname = undefined
  process.env.VERCEL_ENV = 'preview'
  process.env.VERCEL_URL = 'outname-abc123.vercel.app'
  expect(getEmailWebOrigin()).toBe('https://outname-abc123.vercel.app')
})

test('ignores blank or invalid NEXT_PUBLIC_* values', () => {
  relatedHosts['outname-app'] = undefined
  relatedHosts.outname = undefined
  process.env.NEXT_PUBLIC_APP_URL = '   '
  process.env.NEXT_PUBLIC_WEB_URL = 'not-a-url'
  expect(getEmailAppOrigin()).toBe('http://localhost:3000')
  expect(getEmailWebOrigin()).toBe('http://localhost:3002')
})

test('falls back to local origins outside Vercel', () => {
  relatedHosts['outname-app'] = undefined
  relatedHosts.outname = undefined
  expect(getEmailAppOrigin()).toBe('http://localhost:3000')
  expect(getEmailWebOrigin()).toBe('http://localhost:3002')
})
