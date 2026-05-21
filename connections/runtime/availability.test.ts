import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockDbSelect, mockGetConnector } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockGetConnector: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@/connections/registry', () => ({
  getConnector: mockGetConnector,
}))

vi.mock('@/shared/db', () => ({
  db: {
    select: mockDbSelect,
  },
}))

import { resolveConnectionAvailability } from './availability'

function mockConnectionRows(
  rows: Array<{
    grantedScopes?: unknown
    status: 'active' | 'invalid'
  }>
) {
  mockDbSelect.mockReturnValue({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(async () => rows),
      })),
    })),
  })
}

describe('resolveConnectionAvailability', () => {
  beforeEach(() => {
    mockDbSelect.mockReset()
    mockGetConnector.mockReset()
  })

  it('returns connection_unavailable for a missing GitHub repo workspace connection', async () => {
    mockGetConnector.mockReturnValue({ id: 'github' })
    mockConnectionRows([])

    await expect(
      resolveConnectionAvailability({
        requirements: [
          {
            connectorId: 'github.personal_access_token',
            toolId: 'github_repo',
          },
        ],
        userId: 'user_test',
      })
    ).resolves.toEqual({
      readyConnectors: new Set(),
      reconnects: [
        {
          connectorId: 'github.personal_access_token',
          reason: 'connection_unavailable',
          toolId: 'github_repo',
        },
      ],
    })
  })

  it('returns missing_scopes when OAuth granted scopes do not cover tool requirements', async () => {
    mockGetConnector.mockReturnValue({
      authKind: 'oauth2',
    })
    mockConnectionRows([
      {
        status: 'active',
        grantedScopes: ['tweet.read'],
      },
    ])

    await expect(
      resolveConnectionAvailability({
        requirements: [
          {
            connectorId: 'x.oauth2_user',
            requiredScopes: ['tweet.read', 'tweet.write'],
            toolId: 'x_user_api_request',
          },
        ],
        userId: 'user_test',
      })
    ).resolves.toEqual({
      readyConnectors: new Set(),
      reconnects: [
        {
          connectorId: 'x.oauth2_user',
          missing: ['tweet.write'],
          reason: 'missing_scopes',
          toolId: 'x_user_api_request',
        },
      ],
    })
  })
})
