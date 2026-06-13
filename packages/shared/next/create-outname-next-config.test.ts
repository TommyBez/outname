import { describe, expect, it } from 'vitest'
import { LOCAL_PROJECT_ORIGINS } from '../vercel-related-projects'
import { createOutnameNextConfig } from './create-outname-next-config'

describe('createOutnameNextConfig', () => {
  it('routes app /api requests to the related API origin', async () => {
    const config = createOutnameNextConfig({ role: 'app' })
    const rewrites =
      typeof config.rewrites === 'function' ? await config.rewrites() : []

    expect(rewrites).toEqual([
      {
        destination: `${LOCAL_PROJECT_ORIGINS.api}/api/:path*`,
        source: '/api/:path*',
      },
    ])
  })

  it('routes web /api requests to the related API origin', async () => {
    const config = createOutnameNextConfig({ role: 'web' })
    const rewrites =
      typeof config.rewrites === 'function' ? await config.rewrites() : []

    expect(rewrites).toEqual([
      {
        destination: `${LOCAL_PROJECT_ORIGINS.api}/api/:path*`,
        source: '/api/:path*',
      },
    ])
  })

  it('does not add API rewrites to the API project itself', () => {
    const config = createOutnameNextConfig({ role: 'api' })

    expect(config.rewrites).toBeUndefined()
  })
})
