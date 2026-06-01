import { afterEach, expect, test } from 'vitest'
import {
  getCurrentProjectOrigin,
  getRelatedProjectOriginById,
} from './vercel-related-projects'

const originalRelatedProjects = process.env.VERCEL_RELATED_PROJECTS
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

function setRelatedProjects(value: unknown) {
  process.env.VERCEL_RELATED_PROJECTS = JSON.stringify(value)
}

afterEach(() => {
  restoreEnv('VERCEL_RELATED_PROJECTS', originalRelatedProjects)
  restoreEnv('VERCEL_ENV', originalVercelEnv)
  restoreEnv(
    'VERCEL_PROJECT_PRODUCTION_URL',
    originalVercelProjectProductionUrl
  )
  restoreEnv('VERCEL_URL', originalVercelUrl)
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

test('returns the fallback origin when a related project id is missing', () => {
  setRelatedProjects([])

  expect(
    getRelatedProjectOriginById('prj_missing', 'http://localhost:3001')
  ).toBe('http://localhost:3001')
})

test('returns the related project origin for a project id', () => {
  process.env.VERCEL_ENV = 'preview'
  setRelatedProjects([
    {
      project: {
        id: 'prj_app',
        name: 'outname-app',
      },
      production: {
        alias: 'app.outname.com',
      },
      preview: {
        branch: 'outname-app-git-feature.vercel.app',
      },
    },
  ])

  expect(getRelatedProjectOriginById('prj_app', 'http://localhost:3000')).toBe(
    'https://outname-app-git-feature.vercel.app'
  )
})
