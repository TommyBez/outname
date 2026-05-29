import type { Connector } from '@outname/shared/connections/types'
import { describe, expect, it, vi } from 'vitest'
import type { MaintainerTool } from './types'

vi.mock('server-only', () => ({}))

import { validateMaintainerToolCapabilities } from './registry'

const oauthConnector = {
  authKind: 'oauth2',
  oauth2: {
    defaultScopes: ['tweet.read'],
  },
} as unknown as Connector

const tool = {
  id: 'test_oauth_tool',
  capabilities: [
    {
      kind: 'brokered_http',
      connectorId: 'x.oauth2_user',
      requiredScopes: ['fake.scope'],
    },
  ],
} as unknown as MaintainerTool

describe('validateMaintainerToolCapabilities', () => {
  it('throws when a tool requires OAuth scopes outside the connector default bundle', () => {
    expect(() =>
      validateMaintainerToolCapabilities(tool, () => oauthConnector, vi.fn())
    ).toThrow(
      'Tool test_oauth_tool requires OAuth scope outside x.oauth2_user default scope bundle.'
    )
  })
})
