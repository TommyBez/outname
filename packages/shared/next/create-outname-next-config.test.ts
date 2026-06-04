import { afterEach, describe, expect, it } from 'vitest'
import {
  LOCALHOST_PROJECT_ORIGINS,
  PORTLESS_PROJECT_ORIGINS,
} from '../vercel-related-projects'
import { createOutnameNextConfig } from './create-outname-next-config'

const originalPortless = process.env.PORTLESS
const originalPortlessUrl = process.env.PORTLESS_URL

afterEach(() => {
  if (originalPortless === undefined) {
    delete process.env.PORTLESS
  } else {
    process.env.PORTLESS = originalPortless
  }

  if (originalPortlessUrl === undefined) {
    delete process.env.PORTLESS_URL
  } else {
    process.env.PORTLESS_URL = originalPortlessUrl
  }
})

describe('createOutnameNextConfig', () => {
  it('routes app /api requests to localhost API when PORTLESS=0', async () => {
    process.env.PORTLESS = '0'
    delete process.env.PORTLESS_URL

    const config = createOutnameNextConfig({ role: 'app' })
    const rewrites =
      typeof config.rewrites === 'function' ? await config.rewrites() : []

    expect(rewrites).toEqual([
      {
        destination: `${LOCALHOST_PROJECT_ORIGINS.api}/api/:path*`,
        source: '/api/:path*',
      },
    ])
  })

  it('routes app /api requests to portless API when PORTLESS_URL is set', async () => {
    delete process.env.PORTLESS
    process.env.PORTLESS_URL = 'https://app.outname.localhost'

    const config = createOutnameNextConfig({ role: 'app' })
    const rewrites =
      typeof config.rewrites === 'function' ? await config.rewrites() : []

    expect(rewrites).toEqual([
      {
        destination: `${PORTLESS_PROJECT_ORIGINS.api}/api/:path*`,
        source: '/api/:path*',
      },
    ])
  })

  it('routes app /api requests to worktree-prefixed portless API', async () => {
    delete process.env.PORTLESS
    process.env.PORTLESS_URL = 'https://fix-ui.app.outname.localhost'

    const config = createOutnameNextConfig({ role: 'app' })
    const rewrites =
      typeof config.rewrites === 'function' ? await config.rewrites() : []

    expect(rewrites).toEqual([
      {
        destination: 'https://fix-ui.api.outname.localhost/api/:path*',
        source: '/api/:path*',
      },
    ])
  })

  it('does not add API rewrites to the API project itself', () => {
    process.env.PORTLESS = '0'
    delete process.env.PORTLESS_URL

    const config = createOutnameNextConfig({ role: 'api' })

    expect(config.rewrites).toBeUndefined()
  })
})
