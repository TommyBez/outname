import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}))

vi.mock('server-only', () => ({}))

import { getAvailableModels } from './inference-models'

describe('getAvailableModels', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', mockFetch)
  })

  it('filters LLM Gateway models with the same tool capability signal used by its UI', async () => {
    mockFetch.mockResolvedValue(
      Response.json({
        data: [
          {
            context_length: 8192,
            id: 'text-embedding-3-small',
            name: 'Text Embedding 3 Small',
            pricing: {
              completion: '0',
              prompt: '0.02e-6',
            },
            providers: [
              {
                providerId: 'openai',
                tools: false,
              },
            ],
            supported_parameters: ['tools', 'tool_choice'],
          },
          {
            context_length: 128_000,
            id: 'gpt-4o',
            name: 'GPT-4o',
            pricing: {
              completion: '10e-6',
              prompt: '2.5e-6',
            },
            providers: [
              {
                providerId: 'openai',
                tools: true,
              },
            ],
            supported_parameters: ['temperature'],
          },
        ],
      })
    )

    await expect(
      getAvailableModels({ inferenceProvider: 'llm-gateway' })
    ).resolves.toMatchObject([
      {
        id: 'gpt-4o',
        inferenceProvider: 'llm-gateway',
      },
    ])
  })
})
