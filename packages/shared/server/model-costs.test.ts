import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { emptyModelPricing } from '@outname/shared/model-pricing'
import type { LanguageModelUsage } from 'ai'
import {
  buildGenerationUsageObservations,
  estimateModelCost,
  extractActualModelCostFromObservation,
  extractActualVercelGatewayCost,
} from './model-costs'

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

describe('buildGenerationUsageObservations', () => {
  it('builds one observation per generation step', () => {
    const [first, second] = buildGenerationUsageObservations({
      response: response('gen_total', 'openai/gpt-5.4-mini'),
      totalUsage: usageWithRaw({ cost: 0.3 }),
      steps: [
        {
          response: response('gen_step_1', 'openai/gpt-5.4-mini'),
          usage: usageWithRaw({ cost: 0.1 }),
        },
        {
          response: response('gen_step_2', 'openai/gpt-5.4-mini'),
          usage: usageWithRaw({ cost: 0.2 }),
        },
      ],
    })

    expect(first).toMatchObject({
      generationId: 'gen_step_1',
      modelId: 'openai/gpt-5.4-mini',
      rawUsage: { cost: 0.1 },
    })
    expect(second).toMatchObject({
      generationId: 'gen_step_2',
      modelId: 'openai/gpt-5.4-mini',
      rawUsage: { cost: 0.2 },
    })
  })

  it('builds an observation from a single generation result', () => {
    expect(
      buildGenerationUsageObservations({
        response: response('gen_single', 'gpt-5.4-mini'),
        usage: usageWithRaw({ cost_usd_total: 0.000_012 }),
      })
    ).toMatchObject([
      {
        generationId: 'gen_single',
        modelId: 'gpt-5.4-mini',
        rawUsage: { cost_usd_total: 0.000_012 },
      },
    ])
  })
})

describe('extractActualModelCostFromObservation', () => {
  it('extracts LLM Gateway actual cost from documented usage fields', () => {
    expect(
      extractActualModelCostFromObservation({
        inferenceProvider: 'llm-gateway',
        observation: observation({
          rawUsage: {
            completion_tokens: 5,
            cost_usd_total: 0.000_012_5,
            prompt_tokens: 10,
            total_tokens: 15,
          },
        }),
      })
    ).toMatchObject({
      billedModel: 'gpt-5.4-mini',
      costUsd: '0.000012500000',
      generationId: 'gen_123',
      source: 'response_usage',
    })

    expect(
      extractActualModelCostFromObservation({
        inferenceProvider: 'llm-gateway',
        observation: observation({
          rawUsage: {
            cost: 0.000_009,
          },
        }),
      })
    ).toMatchObject({
      costUsd: '0.000009000000',
    })
  })

  it('does not read undocumented LLM Gateway cost details fallbacks', () => {
    expect(
      extractActualModelCostFromObservation({
        inferenceProvider: 'llm-gateway',
        observation: observation({
          rawUsage: {
            cost_details: {
              total_cost: 0.01,
            },
          },
        }),
      })
    ).toBeNull()
  })

  it('extracts OpenRouter actual cost from documented raw usage cost', () => {
    const result = extractActualModelCostFromObservation({
      inferenceProvider: 'openrouter',
      observation: observation({
        modelId: 'openai/gpt-5.4-mini',
        rawUsage: {
          cost: 0.000_032,
          cost_details: {
            upstream_inference_cost: 0.000_02,
          },
        },
      }),
    })

    expect(result).toMatchObject({
      billedModel: 'openai/gpt-5.4-mini',
      costMetadata: {
        currencySource: 'openrouter_usd_credits',
      },
      costUsd: '0.000032000000',
      generationId: 'gen_123',
      source: 'response_usage',
    })
  })

  it('rejects non-numeric documented cost fields', () => {
    expect(
      extractActualModelCostFromObservation({
        inferenceProvider: 'openrouter',
        observation: observation({
          rawUsage: {
            cost: '0.000032',
          },
        }),
      })
    ).toBeNull()
  })
})

describe('extractActualVercelGatewayCost', () => {
  it('extracts Vercel AI Gateway actual cost from generation total_cost', () => {
    expect(
      extractActualVercelGatewayCost({
        generation: {
          data: {
            generation_time: 1234,
            is_byok: false,
            latency: 450,
            model: 'openai/gpt-5.4-mini',
            provider_name: 'openai',
            streamed: true,
            total_cost: 0.000_045,
            usage: {
              completion_tokens: 20,
              prompt_tokens: 10,
            },
          },
        },
        generationId: 'gen_v0',
      })
    ).toMatchObject({
      billedModel: 'openai/gpt-5.4-mini',
      costUsd: '0.000045000000',
      generationId: 'gen_v0',
      source: 'generation_lookup',
      upstreamProvider: 'openai',
    })
  })

  it('does not use Vercel generation usage as a total_cost fallback', () => {
    expect(
      extractActualVercelGatewayCost({
        generation: {
          data: {
            usage: 0.000_045,
          },
        },
        generationId: 'gen_v0',
      })
    ).toBeNull()
  })
})

function observation(input: {
  modelId?: string
  rawUsage: Record<string, unknown> | null
}) {
  return {
    generationId: 'gen_123',
    modelId: input.modelId ?? 'gpt-5.4-mini',
    rawUsage: input.rawUsage,
    responseMetadata: {
      id: 'gen_123',
      modelId: input.modelId ?? 'gpt-5.4-mini',
    },
    usage: usageWithRaw(input.rawUsage ?? {}),
  }
}

function response(id: string, modelId: string) {
  return {
    id,
    modelId,
  }
}

function usageWithRaw(raw: Record<string, unknown>): LanguageModelUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    raw,
    totalTokens: 0,
  } as LanguageModelUsage
}
