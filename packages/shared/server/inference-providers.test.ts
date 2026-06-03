import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockCreateGateway,
  mockCreateOpenRouter,
  mockDbSelect,
  mockDbSelectLimit,
  mockDecryptCredential,
  mockGetUpstashRedis,
  mockRedisDel,
  mockRedisGet,
  mockRedisSet,
} = vi.hoisted(() => {
  const mockCreateGateway = vi.fn()
  const mockCreateOpenRouter = vi.fn()
  const mockDecryptCredential = vi.fn()
  const mockGetUpstashRedis = vi.fn()
  const mockRedisDel = vi.fn()
  const mockRedisGet = vi.fn()
  const mockRedisSet = vi.fn()

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
    mockGetUpstashRedis,
    mockRedisDel,
    mockRedisGet,
    mockRedisSet,
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

vi.mock('@outname/shared/server/upstash-redis', () => ({
  getUpstashRedis: mockGetUpstashRedis,
}))

import { MissingInferenceCredentialError } from './inference-provider-errors'
import { getUserLanguageModel } from './inference-providers'

describe('inference-providers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUpstashRedis.mockReturnValue({
      del: mockRedisDel,
      get: mockRedisGet,
      set: mockRedisSet,
    })
    mockRedisDel.mockResolvedValue(undefined)
    mockRedisGet.mockResolvedValue(null)
    mockRedisSet.mockResolvedValue(undefined)
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
    expect(mockRedisSet).toHaveBeenCalledWith(
      'user:user_123:provider:vercel-ai-gateway:inference-credential',
      'enc_from_db'
    )
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

  it('uses cached encrypted credentials before querying the database', async () => {
    mockRedisGet.mockResolvedValue('enc_from_cache')

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

    expect(mockDbSelect).not.toHaveBeenCalled()
    expect(mockDecryptCredential).toHaveBeenCalledWith('enc_from_cache')
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
