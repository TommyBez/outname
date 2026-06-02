import { describe, expect, it } from 'vitest'
import { connectionOAuthStartPath } from './oauth-paths'

describe('connection OAuth paths', () => {
  it('builds a relative start path for app-origin rewrites', () => {
    expect(connectionOAuthStartPath('x.oauth2_user')).toBe(
      '/api/connections/oauth/x.oauth2_user/start?returnTo=%2Fconnections'
    )
  })

  it('encodes connector ids in the path', () => {
    expect(connectionOAuthStartPath('provider/custom oauth')).toBe(
      '/api/connections/oauth/provider%2Fcustom%20oauth/start?returnTo=%2Fconnections'
    )
  })
})
