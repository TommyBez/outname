import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  normalizeSlackOAuthReturnTo,
  slackOAuthRedirectUri,
} from './oauth-state'

const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL

afterEach(() => {
  if (originalAppUrl === undefined) {
    delete process.env.NEXT_PUBLIC_APP_URL
    return
  }

  process.env.NEXT_PUBLIC_APP_URL = originalAppUrl
})

describe('Slack OAuth state helpers', () => {
  it('builds Slack callback URLs on the app origin', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com/'

    expect(slackOAuthRedirectUri()).toBe(
      'https://app.example.com/api/channels/slack/oauth/callback'
    )
  })

  it('normalizes return targets to app-local paths', () => {
    expect(normalizeSlackOAuthReturnTo('/channels?tab=slack#install')).toBe(
      '/channels?tab=slack#install'
    )
    expect(normalizeSlackOAuthReturnTo('https://evil.example')).toBeNull()
    expect(normalizeSlackOAuthReturnTo('//evil.example')).toBeNull()
  })
})
