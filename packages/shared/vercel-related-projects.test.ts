import { afterEach, expect, test } from 'vitest'
import {
  getCurrentProjectOrigin,
  LOCALHOST_PROJECT_ORIGINS,
  PORTLESS_PROJECT_ORIGINS,
  PROJECT_NAMES,
  resolveLocalProjectOrigins,
} from './vercel-related-projects'

const originalVercelEnv = process.env.VERCEL_ENV
const originalVercelProjectProductionUrl =
  process.env.VERCEL_PROJECT_PRODUCTION_URL
const originalVercelUrl = process.env.VERCEL_URL

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key]
    return
  }

  process.env[key] = value
}

afterEach(() => {
  restoreEnv('VERCEL_ENV', originalVercelEnv)
  restoreEnv(
    'VERCEL_PROJECT_PRODUCTION_URL',
    originalVercelProjectProductionUrl
  )
  restoreEnv('VERCEL_URL', originalVercelUrl)
})

test('exports localhost dev origins for each app role', () => {
  expect(LOCALHOST_PROJECT_ORIGINS).toEqual({
    api: 'http://localhost:3001',
    app: 'http://localhost:3000',
    web: 'http://localhost:3002',
  })
})

test('exports portless dev origins for each app role', () => {
  expect(PORTLESS_PROJECT_ORIGINS).toEqual({
    api: 'https://api.outname.localhost',
    app: 'https://app.outname.localhost',
    web: 'https://web.outname.localhost',
  })
})

test('uses portless origins when PORTLESS_URL is set', () => {
  process.env.PORTLESS_URL = 'https://app.outname.localhost'

  expect(resolveLocalProjectOrigins()).toEqual(PORTLESS_PROJECT_ORIGINS)

  delete process.env.PORTLESS_URL
})

test('uses localhost origins when PORTLESS=0', () => {
  process.env.PORTLESS = '0'
  process.env.PORTLESS_URL = 'https://app.outname.localhost'

  expect(resolveLocalProjectOrigins()).toEqual(LOCALHOST_PROJECT_ORIGINS)

  delete process.env.PORTLESS
  delete process.env.PORTLESS_URL
})

test('exports Vercel project names for each app role', () => {
  expect(PROJECT_NAMES).toEqual({
    api: 'outname-api',
    app: 'outname-app',
    web: 'outname',
  })
})

test('returns current preview project origin', () => {
  process.env.VERCEL_ENV = 'preview'
  process.env.VERCEL_URL = 'outname-app-git-feature.vercel.app'

  expect(getCurrentProjectOrigin('http://localhost:3000')).toBe(
    'https://outname-app-git-feature.vercel.app'
  )
})

test('returns current production project origin', () => {
  process.env.VERCEL_ENV = 'production'
  process.env.VERCEL_PROJECT_PRODUCTION_URL = 'app.outname.com'

  expect(getCurrentProjectOrigin('http://localhost:3000')).toBe(
    'https://app.outname.com'
  )
})

test('returns the fallback origin outside Vercel', () => {
  delete process.env.VERCEL_ENV

  expect(getCurrentProjectOrigin('http://localhost:3000')).toBe(
    'http://localhost:3000'
  )
})

test('returns the fallback origin when preview host is missing', () => {
  process.env.VERCEL_ENV = 'preview'
  delete process.env.VERCEL_URL

  expect(getCurrentProjectOrigin('http://localhost:3000')).toBe(
    'http://localhost:3000'
  )
})

test('falls back to VERCEL_URL in production when production URL is missing', () => {
  process.env.VERCEL_ENV = 'production'
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL
  process.env.VERCEL_URL = 'outname-app.vercel.app'

  expect(getCurrentProjectOrigin('http://localhost:3000')).toBe(
    'https://outname-app.vercel.app'
  )
})

test('normalizes full URLs to origins', () => {
  process.env.VERCEL_ENV = 'preview'
  process.env.VERCEL_URL = 'https://outname-app-git-feature.vercel.app/path'

  expect(getCurrentProjectOrigin('http://localhost:3000')).toBe(
    'https://outname-app-git-feature.vercel.app'
  )
})
