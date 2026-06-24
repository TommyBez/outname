import { afterEach, beforeEach, expect, test, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  buildEmailAppUrl,
  buildEmailWebUrl,
  getEmailAppLoginUrl,
  getEmailAppOrigin,
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
  relatedHosts['outname-api'] = 'https://api.example.com'
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

test('normalizes paths without a leading slash', () => {
  expect(buildEmailAppUrl('login')).toBe('https://app.example.com/login')
  expect(buildEmailWebUrl('blog')).toBe('https://web.example.com/blog')
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
  // Deployment with no related projects and nothing inlined: the target's
  // URL is unknowable, so links must not silently point at the sender's
  // own host.
  relatedHosts['outname-api'] = undefined
  relatedHosts['outname-app'] = undefined
  relatedHosts.outname = undefined
  process.env.VERCEL_ENV = 'production'
  process.env.VERCEL_PROJECT_PRODUCTION_URL = 'api.outna.me'
  expect(getEmailAppOrigin()).toBe('http://localhost:3000')
  expect(getEmailWebOrigin()).toBe('http://localhost:3002')
})

test('does not emit the sender origin on a partially configured list', () => {
  // Non-Next api runtime whose related-projects list only contains the web
  // project: the missing app entry is ambiguous (current project or missing
  // relation), so the resolution must not trust the sender's own env vars.
  relatedHosts['outname-api'] = undefined
  relatedHosts['outname-app'] = undefined
  process.env.VERCEL_ENV = 'production'
  process.env.VERCEL_PROJECT_PRODUCTION_URL = 'api.outna.me'
  expect(getEmailAppOrigin()).toBe('http://localhost:3000')
})

test('ignores blank or invalid NEXT_PUBLIC_* values', () => {
  relatedHosts['outname-api'] = undefined
  relatedHosts['outname-app'] = undefined
  relatedHosts.outname = undefined
  process.env.NEXT_PUBLIC_APP_URL = '   '
  process.env.NEXT_PUBLIC_WEB_URL = 'not-a-url'
  expect(getEmailAppOrigin()).toBe('http://localhost:3000')
  expect(getEmailWebOrigin()).toBe('http://localhost:3002')
})

test('falls back to local origins outside Vercel', () => {
  relatedHosts['outname-api'] = undefined
  relatedHosts['outname-app'] = undefined
  relatedHosts.outname = undefined
  expect(getEmailAppOrigin()).toBe('http://localhost:3000')
  expect(getEmailWebOrigin()).toBe('http://localhost:3002')
})
