import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockCheckBudgetExceeded,
  mockRecordAgentTokenUsage,
  mockResolveActualModelCost,
} = vi.hoisted(() => ({
  mockCheckBudgetExceeded: vi.fn(),
  mockRecordAgentTokenUsage: vi.fn(),
  mockResolveActualModelCost: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@outname/shared/budgets/server/spend', () => ({
  checkBudgetExceeded: mockCheckBudgetExceeded,
}))

vi.mock('@outname/shared/budgets/server/usage', () => ({
  recordAgentTokenUsage: mockRecordAgentTokenUsage,
}))

vi.mock('@outname/shared/server/inference-actual-costs', () => ({
  resolveActualModelCost: mockResolveActualModelCost,
}))

import type { GenerationUsageObservation } from '@outname/shared/server/model-costs'
import { recordTokenUsageStep } from './budget'

describe('recordTokenUsageStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResolveActualModelCost.mockResolvedValue({
      actualCost: null,
      unavailableReason: 'missing_documented_cost',
    })
    mockRecordAgentTokenUsage.mockResolvedValue(undefined)
  })

  it('continues recording later generations when one generation fails', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    mockRecordAgentTokenUsage
      .mockRejectedValueOnce(new Error('insert failed'))
      .mockResolvedValueOnce(undefined)

    try {
      await recordTokenUsageStep({
        userId: 'user_123',
        agentId: 'agent_123',
        rootAgentId: 'agent_123',
        sourceType: 'chat',
        sourceId: 'conv_123',
        inferenceProvider: 'openrouter',
        model: 'openai/gpt-5',
        generations: [
          generation('gen_1', 'openai/gpt-5.4-mini'),
          generation('gen_2', 'openai/gpt-5'),
        ],
      })

      expect(mockResolveActualModelCost).toHaveBeenCalledTimes(2)
      expect(mockRecordAgentTokenUsage).toHaveBeenCalledTimes(2)
      expect(mockRecordAgentTokenUsage).toHaveBeenLastCalledWith(
        expect.objectContaining({
          billedModel: 'openai/gpt-5',
          generationId: 'gen_2',
        })
      )
      expect(consoleError).toHaveBeenCalledWith(
        'recordTokenUsageStep: failed to persist generation usage',
        expect.objectContaining({
          generationId: 'gen_1',
          inferenceProvider: 'openrouter',
          userId: 'user_123',
        })
      )
    } finally {
      consoleError.mockRestore()
    }
  })
})

function generation(
  generationId: string,
  modelId: string
): GenerationUsageObservation {
  return {
    generationId,
    modelId,
    rawUsage: {
      cost: 0.000_01,
    },
    responseMetadata: {
      id: generationId,
      modelId,
    },
    usage: {
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
    } as GenerationUsageObservation['usage'],
  }
}
