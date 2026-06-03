import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { emptyModelPricing } from '@outname/shared/model-pricing'
import { estimateModelCost } from './model-costs'

describe('estimateModelCost', () => {
  it('selects the highest matching tier when pricing tiers are unordered', () => {
    const result = estimateModelCost({
      pricing: {
        ...emptyModelPricing(),
        input: '0.000001',
        inputTiers: [
          { cost: '0.000002', min: 0 },
          { cost: '0.000004', min: 1000 },
        ],
      },
      usage: {
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        inputTokens: 1500,
        outputTokens: 0,
        reasoningTokens: 0,
        totalTokens: 1500,
      },
    })

    expect(result.breakdown.input.rateUsdPerToken).toBe('0.000004')
    expect(result.breakdown.input.costUsd).toBe('0.006000000000')
  })
})
