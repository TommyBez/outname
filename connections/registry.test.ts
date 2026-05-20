import { describe, expect, it, vi } from 'vitest'
import type { Connector } from './types'

vi.mock('server-only', () => ({}))

import { validateConnectorInfrastructureForEnv } from './registry'

const oauthConnector = {
  authKind: 'oauth2',
} as Connector

const apiKeyConnector = {
  authKind: 'api_key',
} as Connector

describe('validateConnectorInfrastructureForEnv', () => {
  it('requires Redis env vars for OAuth connectors in runtime environments', () => {
    expect(() =>
      validateConnectorInfrastructureForEnv([oauthConnector], {
        NODE_ENV: 'development',
      })
    ).toThrow('OAuth connectors require UPSTASH_REDIS_REST_URL')
  })

  it('does not require Redis when no OAuth connector is registered', () => {
    expect(() =>
      validateConnectorInfrastructureForEnv([apiKeyConnector], {
        NODE_ENV: 'production',
      })
    ).not.toThrow()
  })

  it('does not require Redis during tests', () => {
    expect(() =>
      validateConnectorInfrastructureForEnv([oauthConnector], {
        NODE_ENV: 'test',
      })
    ).not.toThrow()
  })
})
