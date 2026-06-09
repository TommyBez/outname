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
  relatedProjects: () =>
    Object.entries(relatedHosts)
      .filter(([, host]) => host !== undefined)
      .map(([name]) => ({ project: { id: name, name } })),
  withRelatedProject: ({
    defaultHost,
    projectName,
  }: {
    defaultHost: string
    projectName: string
  }) => relatedHosts[projectName] ?? defaultHost,
}))

const ENV_VARS = [
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

test('resolves the current project via system env vars in production', () => {
  // The related-projects list never includes the current project: a miss
  // while the list is populated means the email targets the sender itself.
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

test('does not emit the sender origin when related projects are unconfigured', () => {
  // Email sent from a deployment (e.g. the api project) with no related
  // projects configured: the target's URL is unknowable, so links must not
  // silently point at the sender's own host.
  relatedHosts['outname-app'] = undefined
  relatedHosts.outname = undefined
  process.env.VERCEL_ENV = 'production'
  process.env.VERCEL_PROJECT_PRODUCTION_URL = 'api.outna.me'
  expect(getEmailAppOrigin()).toBe('http://localhost:3000')
  expect(getEmailWebOrigin()).toBe('http://localhost:3002')
})

test('falls back to local origins outside Vercel', () => {
  relatedHosts['outname-app'] = undefined
  relatedHosts.outname = undefined
  expect(getEmailAppOrigin()).toBe('http://localhost:3000')
  expect(getEmailWebOrigin()).toBe('http://localhost:3002')
})
