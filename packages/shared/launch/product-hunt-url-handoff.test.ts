import { describe, expect, it, vi } from 'vitest'

const { mockDbSelect } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@outname/db', () => ({
  db: {
    select: mockDbSelect,
  },
}))

vi.mock('@outname/db/schema', () => ({
  launchFeedback: {
    createdAt: 'launchFeedback.createdAt',
    launchKey: 'launchFeedback.launchKey',
    referrer: 'launchFeedback.referrer',
  },
  waitlistEntry: {
    createdAt: 'waitlistEntry.createdAt',
    referrer: 'waitlistEntry.referrer',
    source: 'waitlistEntry.source',
    utmCampaign: 'waitlistEntry.utmCampaign',
  },
}))

vi.mock('drizzle-orm', () => ({
  and: vi.fn(),
  desc: vi.fn(),
  eq: vi.fn(),
  isNotNull: vi.fn(),
  or: vi.fn(),
}))

import {
  collectProductHuntLaunchUrlHandoffs,
  getProductHuntLaunchUrlHandoffCandidates,
} from './product-hunt-url-handoff'

function createSelectChain(rows: unknown[]) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn(async () => rows),
        })),
      })),
    })),
  }
}

describe('Product Hunt URL handoff', () => {
  it('collects canonical Product Hunt post URLs from recent referrers', () => {
    expect(
      collectProductHuntLaunchUrlHandoffs([
        {
          referrer: 'https://www.producthunt.com/posts/custom-outname?utm=ph).',
        },
        {
          referrer:
            'https://producthunt.com/posts/custom-outname https://www.producthunt.com/posts/outna-me-2',
        },
        { referrer: 'https://example.com/posts/custom-outname' },
        { referrer: null },
      ])
    ).toEqual([
      'https://www.producthunt.com/posts/custom-outname',
      'https://www.producthunt.com/posts/outna-me-2',
    ])
  })

  it('reads launch feedback and waitlist referrers as handoff candidates', async () => {
    mockDbSelect
      .mockReturnValueOnce(
        createSelectChain([
          {
            referrer: 'https://www.producthunt.com/posts/custom-outname',
          },
        ])
      )
      .mockReturnValueOnce(
        createSelectChain([
          {
            referrer: 'https://www.producthunt.com/posts/outna-me-2?ref=site',
          },
        ])
      )

    await expect(
      getProductHuntLaunchUrlHandoffCandidates({ limit: 500 })
    ).resolves.toEqual([
      'https://www.producthunt.com/posts/custom-outname',
      'https://www.producthunt.com/posts/outna-me-2',
    ])
    expect(mockDbSelect).toHaveBeenCalledTimes(2)
  })
})
