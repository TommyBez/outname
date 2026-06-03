import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockCreateGateway,
  mockCreateOpenRouter,
  mockDbSelect,
  mockDbSelectLimit,
  mockDecryptCredential,
} = vi.hoisted(() => {
  const mockCreateGateway = vi.fn()
  const mockCreateOpenRouter = vi.fn()
  const mockDecryptCredential = vi.fn()

  const mockDbSelectLimit = vi.fn()
  const mockDbSelectWhere = vi.fn(() => ({ limit: mockDbSelectLimit }))
  const mockDbSelectFrom = vi.fn(() => ({ where: mockDbSelectWhere }))
  const mockDbSelect = vi.fn(() => ({ from: mockDbSelectFrom }))

  return {
    mockCreateGateway,
    mockCreateOpenRouter,
    mockDbSelect,
    mockDbSelectLimit,
    mockDecryptCredential,
  }
})

vi.mock('server-only', () => ({}))

vi.mock('ai', () => ({
  createGateway: mockCreateGateway,
}))

vi.mock('@openrouter/ai-sdk-provider', () => ({
  createOpenRouter: mockCreateOpenRouter,
}))

vi.mock('@outname/shared/connections/crypto', () => ({
  decryptCredential: mockDecryptCredential,
  encryptCredential: vi.fn(),
}))

vi.mock('@outname/db', () => ({
  db: {
    select: mockDbSelect,
  },
}))

import {
  getUserLanguageModel,
  MissingInferenceCredentialError,
} from './inference-providers'

describe('inference-providers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDbSelectLimit.mockResolvedValue([
      {
        encryptedCredentials: 'enc_from_db',
        status: 'enabled',
      },
    ])
    mockDecryptCredential.mockResolvedValue({ apiKey: 'provider_secret' })
    mockCreateGateway.mockImplementation(
      ({ apiKey }: { apiKey: string }) =>
        (modelId: string) => ({
          apiKey,
          kind: 'gateway',
          modelId,
        })
    )
    mockCreateOpenRouter.mockImplementation(
      ({ apiKey }: { apiKey: string }) =>
        (modelId: string) => ({
          apiKey,
          kind: 'openrouter',
          modelId,
        })
    )
  })

  it('creates a Vercel AI Gateway language model from the saved user key', async () => {
    await expect(
      getUserLanguageModel({
        inferenceProvider: 'vercel-ai-gateway',
        modelId: 'openai/gpt-5.4-nano',
        userId: 'user_123',
      })
    ).resolves.toEqual({
      apiKey: 'provider_secret',
      kind: 'gateway',
      modelId: 'openai/gpt-5.4-nano',
    })

    expect(mockCreateGateway).toHaveBeenCalledWith({
      apiKey: 'provider_secret',
    })
  })

  it('creates an OpenRouter language model with strict tool-provider options', async () => {
    await expect(
      getUserLanguageModel({
        inferenceProvider: 'openrouter',
        modelId: 'anthropic/claude-sonnet-4.5',
        userId: 'user_123',
      })
    ).resolves.toEqual({
      apiKey: 'provider_secret',
      kind: 'openrouter',
      modelId: 'anthropic/claude-sonnet-4.5',
    })

    expect(mockCreateOpenRouter).toHaveBeenCalledWith({
      apiKey: 'provider_secret',
      appName: 'OUTNA.ME',
      compatibility: 'strict',
      extraBody: {
        provider: {
          allow_fallbacks: false,
          require_parameters: true,
        },
      },
    })
  })

  it('throws a non-retryable missing-credential error when the provider is not enabled', async () => {
    mockDbSelectLimit.mockResolvedValue([
      {
        encryptedCredentials: 'enc_from_db',
        status: 'invalid',
      },
    ])

    await expect(
      getUserLanguageModel({
        inferenceProvider: 'openrouter',
        modelId: 'openai/gpt-4o',
        userId: 'user_123',
      })
    ).rejects.toBeInstanceOf(MissingInferenceCredentialError)
  })
})
