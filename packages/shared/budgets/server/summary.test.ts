import { beforeEach, describe, expect, it, vi } from 'vitest'

const { clearQueuedResults, mockDbSelect, queueResult } = vi.hoisted(() => {
  const results: unknown[][] = []
  const queueResult = (rows: unknown[]) => {
    results.push(rows)
  }
  const clearQueuedResults = () => {
    results.length = 0
  }
  const nextResult = () => Promise.resolve(results.shift() ?? [])

  const mockDbSelect = vi.fn(() => ({
    from: () => ({
      where: () => {
        let cached: Promise<unknown[]> | null = null
        const resolve = () => {
          cached ??= nextResult()
          return cached
        }
        return {
          groupBy: () => resolve(),
          // biome-ignore lint/suspicious/noThenProperty: intentionally thenable to emulate drizzle's awaitable query builder
          then: (
            onFulfilled?: (rows: unknown[]) => unknown,
            onRejected?: (error: unknown) => unknown
          ) => resolve().then(onFulfilled, onRejected),
        }
      },
    }),
  }))

  return { clearQueuedResults, mockDbSelect, queueResult }
})

vi.mock('server-only', () => ({}))

vi.mock('@outname/db', () => ({
  db: {
    select: mockDbSelect,
  },
}))

import { loadAgentBudgetSummaries } from './summary'

describe('loadAgentBudgetSummaries', () => {
  beforeEach(() => {
    clearQueuedResults()
    mockDbSelect.mockClear()
  })

  it('returns an empty map without querying when no agent ids are given', async () => {
    const summaries = await loadAgentBudgetSummaries({
      userId: 'u1',
      agentIds: [],
    })

    expect(summaries.size).toBe(0)
    expect(mockDbSelect).not.toHaveBeenCalled()
  })

  it('returns an empty map when no rules exist', async () => {
    queueResult([])

    const summaries = await loadAgentBudgetSummaries({
      userId: 'u1',
      agentIds: ['a1', 'a2'],
    })

    expect(summaries.size).toBe(0)
    expect(mockDbSelect).toHaveBeenCalledTimes(1)
  })

  it('groups entries per agent, applies spend, and sorts by period', async () => {
    queueResult([
      {
        agentId: 'a1',
        period: 'monthly',
        limitUsd: '30',
        enabled: true,
      },
      {
        agentId: 'a1',
        period: 'daily',
        limitUsd: '1.5',
        enabled: true,
      },
      {
        agentId: 'a2',
        period: 'weekly',
        limitUsd: '10',
        enabled: false,
      },
    ])
    queueResult([
      { rootAgentId: 'a1', daily: '0.25', weekly: '1', monthly: '4.5' },
    ])

    const summaries = await loadAgentBudgetSummaries({
      userId: 'u1',
      agentIds: ['a1', 'a2', 'a3'],
    })

    expect(summaries.get('a1')).toEqual([
      { period: 'daily', limitUsd: 1.5, enabled: true, spentUsd: 0.25 },
      { period: 'monthly', limitUsd: 30, enabled: true, spentUsd: 4.5 },
    ])
    expect(summaries.get('a2')).toEqual([
      { period: 'weekly', limitUsd: 10, enabled: false, spentUsd: 0 },
    ])
    expect(summaries.has('a3')).toBe(false)
    expect(mockDbSelect).toHaveBeenCalledTimes(2)
  })
})
