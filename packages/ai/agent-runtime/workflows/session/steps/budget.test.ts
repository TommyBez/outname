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

import type {
  ActualModelCost,
  GenerationUsageObservation,
} from '@outname/shared/server/model-costs'
import { recordTokenUsageStep } from './budget'

const RECORD_USAGE_ERROR_MESSAGE =
  'recordTokenUsageStep: failed to persist generation usage'

type RecordTokenUsageInput = Parameters<typeof recordTokenUsageStep>[0]

describe('recordTokenUsageStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResolveActualModelCost.mockResolvedValue({
      actualCost: null,
      unavailableReason: 'missing_documented_cost',
    })
    mockRecordAgentTokenUsage.mockResolvedValue(undefined)
  })

  it('records every generation with resolved actual cost metadata', async () => {
    const generations = [
      generation('gen_1', 'openai/gpt-5.4-mini'),
      generation('gen_2', 'openai/gpt-5'),
    ]
    const firstActualCost = actualCost('gen_1', 'openai/gpt-5.4-mini')
    const secondActualCost = actualCost('gen_2', 'openai/gpt-5')
    mockResolveActualModelCost
      .mockResolvedValueOnce({
        actualCost: firstActualCost,
        unavailableReason: null,
      })
      .mockResolvedValueOnce({
        actualCost: secondActualCost,
        unavailableReason: null,
      })

    await recordTokenUsageStep(
      recordInput({
        generations,
      })
    )

    expect(mockResolveActualModelCost).toHaveBeenCalledTimes(2)
    expect(mockResolveActualModelCost).toHaveBeenNthCalledWith(1, {
      inferenceProvider: 'openrouter',
      observation: generations[0],
      userId: 'user_123',
    })
    expect(mockResolveActualModelCost).toHaveBeenNthCalledWith(2, {
      inferenceProvider: 'openrouter',
      observation: generations[1],
      userId: 'user_123',
    })
    expect(mockRecordAgentTokenUsage).toHaveBeenCalledTimes(2)
    expect(mockRecordAgentTokenUsage).toHaveBeenNthCalledWith(1, {
      actualCost: firstActualCost,
      actualCostUnavailableReason: null,
      agentId: 'agent_123',
      billedModel: 'openai/gpt-5.4-mini',
      generationId: 'gen_1',
      inferenceProvider: 'openrouter',
      model: 'openai/gpt-5',
      rootAgentId: 'agent_123',
      sourceId: 'conv_123',
      sourceType: 'chat',
      usage: generations[0].usage,
      userId: 'user_123',
    })
    expect(mockRecordAgentTokenUsage).toHaveBeenNthCalledWith(2, {
      actualCost: secondActualCost,
      actualCostUnavailableReason: null,
      agentId: 'agent_123',
      billedModel: 'openai/gpt-5',
      generationId: 'gen_2',
      inferenceProvider: 'openrouter',
      model: 'openai/gpt-5',
      rootAgentId: 'agent_123',
      sourceId: 'conv_123',
      sourceType: 'chat',
      usage: generations[1].usage,
      userId: 'user_123',
    })
  })

  it('continues recording later generations when one generation fails', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    mockRecordAgentTokenUsage
      .mockRejectedValueOnce(new Error('insert failed'))
      .mockResolvedValueOnce(undefined)
    const generations = [
      generation('gen_1', 'openai/gpt-5.4-mini'),
      generation('gen_2', 'openai/gpt-5'),
    ]

    try {
      await recordTokenUsageStep(
        recordInput({
          generations,
        })
      )

      expect(mockResolveActualModelCost).toHaveBeenCalledTimes(2)
      expect(mockRecordAgentTokenUsage).toHaveBeenCalledTimes(2)
      expect(mockRecordAgentTokenUsage).toHaveBeenLastCalledWith(
        expect.objectContaining({
          billedModel: 'openai/gpt-5',
          generationId: 'gen_2',
        })
      )
      expect(consoleError).toHaveBeenCalledWith(
        RECORD_USAGE_ERROR_MESSAGE,
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

  it('does not throw when every generation usage insert fails', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const insertError = new Error('insert failed')
    mockRecordAgentTokenUsage.mockRejectedValue(insertError)
    const generations = [
      generation('gen_1', 'openai/gpt-5.4-mini'),
      generation('gen_2', 'openai/gpt-5'),
    ]

    try {
      await expect(
        recordTokenUsageStep(
          recordInput({
            generations,
          })
        )
      ).resolves.toBeUndefined()

      expect(mockResolveActualModelCost).toHaveBeenCalledTimes(2)
      expect(mockRecordAgentTokenUsage).toHaveBeenCalledTimes(2)
      expect(consoleError).toHaveBeenCalledTimes(2)
      expect(consoleError).toHaveBeenNthCalledWith(
        1,
        RECORD_USAGE_ERROR_MESSAGE,
        expect.objectContaining({
          err: insertError,
          generationId: 'gen_1',
          inferenceProvider: 'openrouter',
          userId: 'user_123',
        })
      )
      expect(consoleError).toHaveBeenNthCalledWith(
        2,
        RECORD_USAGE_ERROR_MESSAGE,
        expect.objectContaining({
          err: insertError,
          generationId: 'gen_2',
          inferenceProvider: 'openrouter',
          userId: 'user_123',
        })
      )
    } finally {
      consoleError.mockRestore()
    }
  })

  it('handles actual cost resolution failures without recording that generation', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const resolutionError = new Error('lookup failed')
    const generations = [
      generation('gen_1', 'openai/gpt-5.4-mini'),
      generation('gen_2', 'openai/gpt-5'),
    ]
    mockResolveActualModelCost
      .mockRejectedValueOnce(resolutionError)
      .mockResolvedValueOnce({
        actualCost: null,
        unavailableReason: 'missing_documented_cost',
      })

    try {
      await recordTokenUsageStep(
        recordInput({
          generations,
        })
      )

      expect(mockResolveActualModelCost).toHaveBeenCalledTimes(2)
      expect(mockRecordAgentTokenUsage).toHaveBeenCalledTimes(1)
      expect(mockRecordAgentTokenUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          billedModel: 'openai/gpt-5',
          generationId: 'gen_2',
        })
      )
      expect(consoleError).toHaveBeenCalledTimes(1)
      expect(consoleError).toHaveBeenCalledWith(
        RECORD_USAGE_ERROR_MESSAGE,
        expect.objectContaining({
          err: resolutionError,
          generationId: 'gen_1',
          inferenceProvider: 'openrouter',
          userId: 'user_123',
        })
      )
    } finally {
      consoleError.mockRestore()
    }
  })

  it.each([
    'heartbeat',
    'dreaming',
    'invocation',
  ] as const)('records %s usage with billed model and generation identifiers', async (sourceType) => {
    const generations = [generation('gen_1', 'openai/gpt-5.4-mini')]

    await recordTokenUsageStep(
      recordInput({
        generations,
        sourceId: `${sourceType}_123`,
        sourceType,
      })
    )

    expect(mockResolveActualModelCost).toHaveBeenCalledTimes(1)
    expect(mockRecordAgentTokenUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        billedModel: 'openai/gpt-5.4-mini',
        generationId: 'gen_1',
        sourceId: `${sourceType}_123`,
        sourceType,
      })
    )
  })
})

function recordInput(
  overrides: Partial<RecordTokenUsageInput> = {}
): RecordTokenUsageInput {
  return {
    userId: 'user_123',
    agentId: 'agent_123',
    rootAgentId: 'agent_123',
    sourceType: 'chat',
    sourceId: 'conv_123',
    inferenceProvider: 'openrouter',
    model: 'openai/gpt-5',
    generations: [generation('gen_1', 'openai/gpt-5.4-mini')],
    ...overrides,
  }
}

function actualCost(
  generationId: string,
  billedModel: string
): ActualModelCost {
  return {
    billedModel,
    costMetadata: {
      source: 'test',
    },
    costUsd: '0.000001',
    generationId,
    source: 'response_usage',
    upstreamProvider: 'openai',
  }
}

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
