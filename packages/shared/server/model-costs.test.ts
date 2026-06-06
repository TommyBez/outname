import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { emptyModelPricing } from '@outname/shared/model-pricing'
import { estimateModelCost, extractActualModelCost } from './model-costs'

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

  it('extracts actual LLM Gateway cost from provider metadata', () => {
    const result = extractActualModelCost({
      inferenceProvider: 'llm-gateway',
      result: {
        providerMetadata: {
          llmgateway: {
            usage: {
              completionTokens: 5,
              cost: 0.000_012_5,
              promptTokens: 10,
              totalTokens: 15,
            },
          },
        },
      },
    })

    expect(result).toEqual({
      costUsd: '0.000012500000',
      costMetadata: {
        llmGatewayUsage: {
          completionTokens: 5,
          cost: 0.000_012_5,
          promptTokens: 10,
          totalTokens: 15,
        },
      },
    })
  })

  it('extracts actual LLM Gateway cost from documented usage fields', () => {
    expect(
      extractActualModelCost({
        inferenceProvider: 'llm-gateway',
        result: {
          steps: [
            {
              providerMetadata: {
                llmgateway: {
                  usage: {
                    cost_details: {
                      total_cost: '0.000009',
                    },
                  },
                },
              },
            },
          ],
        },
      })
    ).toMatchObject({
      costUsd: '0.000009000000',
    })

    expect(
      extractActualModelCost({
        inferenceProvider: 'llm-gateway',
        result: {
          providerMetadata: {
            llmgateway: {
              usage: {
                cost_usd_total: 0.000_007,
              },
            },
          },
        },
      })
    ).toMatchObject({
      costUsd: '0.000007000000',
    })
  })

  it('returns no actual cost for providers without a provider-specific extractor', () => {
    expect(
      extractActualModelCost({
        inferenceProvider: 'openrouter',
        result: {
          providerMetadata: {
            llmgateway: {
              usage: {
                cost: 0.01,
              },
            },
          },
        },
      })
    ).toBeNull()
  })
})
