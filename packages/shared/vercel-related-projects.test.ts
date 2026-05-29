import { afterEach, expect, test } from 'vitest'
import {
  getRelatedProjectOrigin,
  getRelatedProjectOrigins,
  VERCEL_API_PROJECT_IDENTIFIERS,
  VERCEL_FRONTEND_PROJECT_IDENTIFIERS,
  VERCEL_PROJECT_IDS,
  VERCEL_PROJECT_NAMES,
} from './vercel-related-projects'

const originalRelatedProjects = process.env.VERCEL_RELATED_PROJECTS
const originalVercelEnv = process.env.VERCEL_ENV

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
})

test('uses the preview host from official Vercel related project metadata', () => {
  process.env.VERCEL_ENV = 'preview'
  setRelatedProjects([
    {
      project: {
        id: VERCEL_PROJECT_IDS.api,
        name: VERCEL_PROJECT_NAMES.api,
      },
      production: {
        alias: 'api.outname.com',
        url: 'outname-api-production.vercel.app',
      },
      preview: {
        branch: 'outname-api-git-feature.vercel.app',
      },
    },
  ])

  expect(getRelatedProjectOrigin(VERCEL_API_PROJECT_IDENTIFIERS)).toBe(
    'https://outname-api-git-feature.vercel.app'
  )
})

test('uses the production alias from official Vercel related project metadata', () => {
  process.env.VERCEL_ENV = 'production'
  setRelatedProjects([
    {
      project: {
        id: VERCEL_PROJECT_IDS.api,
        name: VERCEL_PROJECT_NAMES.api,
      },
      production: {
        alias: 'api.outname.com',
        url: 'outname-api-production.vercel.app',
      },
      preview: {
        branch: 'outname-api-git-feature.vercel.app',
      },
    },
  ])

  expect(getRelatedProjectOrigin(VERCEL_API_PROJECT_IDENTIFIERS)).toBe(
    'https://api.outname.com'
  )
})

test('matches frontend related projects by nested project identity', () => {
  process.env.VERCEL_ENV = 'preview'
  setRelatedProjects([
    {
      project: {
        id: VERCEL_PROJECT_IDS.app,
        name: VERCEL_PROJECT_NAMES.app,
      },
      production: {
        alias: 'app.outname.com',
      },
      preview: {
        branch: 'outname-app-git-feature.vercel.app',
      },
    },
    {
      project: {
        id: VERCEL_PROJECT_IDS.web,
        name: VERCEL_PROJECT_NAMES.web,
      },
      production: {
        alias: 'outname.com',
      },
      preview: {
        branch: 'outname-git-feature.vercel.app',
      },
    },
  ])

  expect(getRelatedProjectOrigins(VERCEL_FRONTEND_PROJECT_IDENTIFIERS)).toEqual(
    [
      'https://outname-app-git-feature.vercel.app',
      'https://outname-git-feature.vercel.app',
    ]
  )
})
