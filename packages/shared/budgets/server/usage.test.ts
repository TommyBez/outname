import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockDbInsert, mockDbValues, mockGetModelPricing } = vi.hoisted(() => ({
  mockDbInsert: vi.fn(),
  mockDbValues: vi.fn(),
  mockGetModelPricing: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@outname/db', () => ({
  db: {
    insert: mockDbInsert,
  },
}))

vi.mock('@outname/shared/server/inference-models', () => ({
  getModelPricing: mockGetModelPricing,
}))

import { emptyModelPricing } from '@outname/shared/model-pricing'
import type { ActualModelCost } from '@outname/shared/server/model-costs'
import type { LanguageModelUsage } from 'ai'
import { recordAgentTokenUsage } from './usage'

describe('recordAgentTokenUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDbInsert.mockReturnValue({
      values: mockDbValues,
    })
    mockDbValues.mockResolvedValue(undefined)
    mockGetModelPricing.mockResolvedValue({
      ...emptyModelPricing(),
      input: '0.000001',
      output: '0.000002',
    })
  })

  it('persists actual generation cost and generation metadata', async () => {
    const actualCost: ActualModelCost = {
      billedModel: 'openai/gpt-5.4-mini',
      costMetadata: {
        vercelAiGatewayGeneration: {
          latency: 450,
        },
      },
      costUsd: '0.000045000000',
      generationId: 'gen_v0',
      source: 'generation_lookup',
      upstreamProvider: 'openai',
    }

    await recordAgentTokenUsage({
      userId: 'user_123',
      agentId: 'agent_123',
      rootAgentId: 'agent_123',
      sourceType: 'chat',
      sourceId: 'conv_123',
      inferenceProvider: 'vercel-ai-gateway',
      model: 'openai/gpt-5.4-mini',
      actualCost,
      billedModel: 'ignored-response-model',
      generationId: 'ignored_gen',
      usage: usage({
        inputTokens: 10,
        outputTokens: 20,
      }),
    })

    expect(mockDbValues).toHaveBeenCalledWith(
      expect.objectContaining({
        actualCostUsd: '0.000045000000',
        billedModel: 'openai/gpt-5.4-mini',
        costSource: 'actual',
        generationId: 'gen_v0',
        requestedModel: 'openai/gpt-5.4-mini',
        upstreamProvider: 'openai',
      })
    )
    expect(mockDbValues.mock.calls[0]?.[0].costMetadata).toMatchObject({
      actual: {
        vercelAiGatewayGeneration: {
          latency: 450,
        },
      },
      actualUnavailableReason: null,
    })
  })

  it('persists estimated generation cost when actual cost is unavailable', async () => {
    await recordAgentTokenUsage({
      userId: 'user_123',
      agentId: 'agent_123',
      rootAgentId: 'agent_123',
      sourceType: 'chat',
      sourceId: 'conv_123',
      inferenceProvider: 'openrouter',
      model: 'openai/gpt-5.4-mini',
      actualCostUnavailableReason: 'missing_documented_cost',
      billedModel: 'openai/gpt-5.4-mini',
      generationId: 'gen_or',
      usage: usage({
        inputTokens: 10,
        outputTokens: 20,
      }),
    })

    expect(mockDbValues).toHaveBeenCalledWith(
      expect.objectContaining({
        actualCostUsd: null,
        billedModel: 'openai/gpt-5.4-mini',
        costSource: 'estimated',
        estimatedCostUsd: '0.000050000000',
        generationId: 'gen_or',
        upstreamProvider: null,
      })
    )
    expect(mockDbValues.mock.calls[0]?.[0].costMetadata).toMatchObject({
      actual: null,
      actualUnavailableReason: 'missing_documented_cost',
    })
  })
})

function usage(input: {
  inputTokens: number
  outputTokens: number
}): LanguageModelUsage {
  return {
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    totalTokens: input.inputTokens + input.outputTokens,
  } as LanguageModelUsage
}
