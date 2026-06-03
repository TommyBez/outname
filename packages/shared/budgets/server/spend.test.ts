import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockDbSelect, mockDbWhere } = vi.hoisted(() => {
  const mockDbWhere = vi.fn()
  const mockDbFrom = vi.fn(() => ({ where: mockDbWhere }))
  const mockDbSelect = vi.fn(() => ({ from: mockDbFrom }))

  return {
    mockDbSelect,
    mockDbWhere,
  }
})

vi.mock('server-only', () => ({}))

vi.mock('@outname/db', () => ({
  db: {
    select: mockDbSelect,
  },
}))

import { sumSpendUsd } from './spend'

function columnNamesFromSelection(selection: {
  total: { queryChunks: unknown[] }
}) {
  const names: string[] = []
  for (const chunk of selection.total.queryChunks) {
    if (
      chunk &&
      typeof chunk === 'object' &&
      'name' in chunk &&
      typeof chunk.name === 'string'
    ) {
      names.push(chunk.name)
    }
  }
  return names
}

describe('sumSpendUsd', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDbWhere.mockResolvedValue([{ total: '12.5' }])
  })

  it('sums actual and estimated cost columns after inference provider migration', async () => {
    await sumSpendUsd({
      userId: 'user_1',
      scope: { type: 'general' },
      period: 'daily',
      now: new Date('2026-06-03T12:00:00.000Z'),
    })

    expect(mockDbSelect).toHaveBeenCalledTimes(1)
    const [selection] = mockDbSelect.mock.calls[0] ?? []
    expect(columnNamesFromSelection(selection)).toEqual([
      'actual_cost_usd',
      'estimated_cost_usd',
    ])
  })
})
