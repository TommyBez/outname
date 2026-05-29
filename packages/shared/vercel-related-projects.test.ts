import { afterEach, expect, test } from 'vitest'
import {
  getRelatedProjectOrigin,
  getRelatedProjectOrigins,
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
        id: 'prj_api',
        name: 'outname-api',
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

  expect(getRelatedProjectOrigin('outname-api')).toBe(
    'https://outname-api-git-feature.vercel.app'
  )
})

test('uses the production alias from official Vercel related project metadata', () => {
  process.env.VERCEL_ENV = 'production'
  setRelatedProjects([
    {
      project: {
        id: 'prj_api',
        name: 'outname-api',
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

  expect(getRelatedProjectOrigin('outname-api')).toBe('https://api.outname.com')
})

test('returns all related project origins when no project names are provided', () => {
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
    {
      project: {
        id: 'prj_web',
        name: 'outname',
      },
      production: {
        alias: 'outname.com',
      },
      preview: {
        branch: 'outname-git-feature.vercel.app',
      },
    },
  ])

  expect(getRelatedProjectOrigins()).toEqual([
    'https://outname-app-git-feature.vercel.app',
    'https://outname-git-feature.vercel.app',
  ])
})
