import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockFetch, mockReadApiKey, mockSleep } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockReadApiKey: vi.fn(),
  mockSleep: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('node:timers/promises', () => ({
  setTimeout: mockSleep,
}))

vi.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: vi.fn(),
}))

vi.mock('ai', () => ({
  createGateway: vi.fn(),
}))

vi.mock('./inference-credentials', () => ({
  readUserInferenceCredentialApiKey: mockReadApiKey,
}))

import { resolveActualModelCost } from './inference-actual-costs'
import type { GenerationUsageObservation } from './model-costs'

describe('resolveActualModelCost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', mockFetch)
    mockReadApiKey.mockResolvedValue('vck_secret')
    mockSleep.mockResolvedValue(undefined)
  })

  it('resolves OpenRouter cost from response usage without generation lookup', async () => {
    await expect(
      resolveActualModelCost({
        userId: 'user_123',
        inferenceProvider: 'openrouter',
        observation: observation({
          rawUsage: {
            cost: 0.000_021,
          },
        }),
      })
    ).resolves.toMatchObject({
      actualCost: {
        costUsd: '0.000021000000',
        source: 'response_usage',
      },
      unavailableReason: null,
    })

    expect(mockFetch).not.toHaveBeenCalled()
    expect(mockReadApiKey).not.toHaveBeenCalled()
  })

  it('looks up Vercel AI Gateway generation cost with the user key', async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            model: 'openai/gpt-5.4-mini',
            provider_name: 'openai',
            total_cost: 0.000_045,
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    )

    await expect(
      resolveActualModelCost({
        userId: 'user_123',
        inferenceProvider: 'vercel-ai-gateway',
        observation: observation({ generationId: 'gen_v0', rawUsage: null }),
      })
    ).resolves.toMatchObject({
      actualCost: {
        billedModel: 'openai/gpt-5.4-mini',
        costUsd: '0.000045000000',
        generationId: 'gen_v0',
        source: 'generation_lookup',
        upstreamProvider: 'openai',
      },
      unavailableReason: null,
    })

    expect(mockReadApiKey).toHaveBeenCalledWith({
      inferenceProvider: 'vercel-ai-gateway',
      userId: 'user_123',
    })
    expect(mockFetch).toHaveBeenCalledWith(
      'https://ai-gateway.vercel.sh/v1/generation?id=gen_v0',
      expect.objectContaining({
        cache: 'no-store',
        headers: {
          authorization: 'Bearer vck_secret',
        },
      })
    )
  })

  it('retries Vercel AI Gateway generation lookup only when generation is not ready', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response('{}', { status: 404 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              total_cost: 0.000_03,
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )

    await expect(
      resolveActualModelCost({
        userId: 'user_123',
        inferenceProvider: 'vercel-ai-gateway',
        observation: observation({ generationId: 'gen_v0', rawUsage: null }),
      })
    ).resolves.toMatchObject({
      actualCost: {
        costUsd: '0.000030000000',
      },
      unavailableReason: null,
    })

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockSleep).toHaveBeenCalledWith(1000)
  })

  it('does not retry non-404 Vercel AI Gateway lookup failures', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 429 }))

    await expect(
      resolveActualModelCost({
        userId: 'user_123',
        inferenceProvider: 'vercel-ai-gateway',
        observation: observation({ generationId: 'gen_v0', rawUsage: null }),
      })
    ).resolves.toEqual({
      actualCost: null,
      unavailableReason: 'generation_lookup_http_429',
    })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockSleep).not.toHaveBeenCalled()
  })
})

function observation(input: {
  generationId?: string
  modelId?: string
  rawUsage: Record<string, unknown> | null
}): GenerationUsageObservation {
  const generationId = input.generationId ?? 'gen_123'
  const modelId = input.modelId ?? 'openai/gpt-5.4-mini'
  return {
    generationId,
    modelId,
    rawUsage: input.rawUsage,
    responseMetadata: {
      id: generationId,
      modelId,
    },
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      raw: input.rawUsage ?? undefined,
      totalTokens: 0,
    } as GenerationUsageObservation['usage'],
  }
}
