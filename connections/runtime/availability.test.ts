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

function mockConnectionRows(rows: Array<{ status: 'active' | 'invalid' }>) {
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
        requirements: [{ provider: 'github', toolId: 'github_repo' }],
        userId: 'user_test',
      })
    ).resolves.toEqual({
      readyProviders: new Set(),
      reconnects: [
        {
          provider: 'github',
          reason: 'connection_unavailable',
          toolId: 'github_repo',
        },
      ],
    })
  })
})
