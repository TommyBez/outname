import { afterEach, describe, expect, it } from 'vitest'
import { buildAppUrl, getAppBaseUrl, getAppLoginUrl } from './app-url'

const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL

afterEach(() => {
  if (originalAppUrl === undefined) {
    delete process.env.NEXT_PUBLIC_APP_URL
    return
  }

  process.env.NEXT_PUBLIC_APP_URL = originalAppUrl
})

describe('app url helpers', () => {
  it('normalizes the configured app base URL', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com///'

    expect(getAppBaseUrl()).toBe('https://app.example.com')
  })

  it('requires the app base URL to be provided by Next config', () => {
    delete process.env.NEXT_PUBLIC_APP_URL

    expect(() => getAppBaseUrl()).toThrow(
      'NEXT_PUBLIC_APP_URL must be set by createOutnameNextConfig.'
    )
  })

  it('builds app-origin URLs with search params and hashes', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com/'

    expect(
      buildAppUrl('/channels#slack', {
        connection: 'error',
        reason: 'unauthorized',
      })
    ).toBe(
      'https://app.example.com/channels?connection=error&reason=unauthorized#slack'
    )
  })

  it('builds login URLs on the app origin', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com'

    expect(getAppLoginUrl('/connections')).toBe(
      'https://app.example.com/login?from=%2Fconnections'
    )
  })
})
