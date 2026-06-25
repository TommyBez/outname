import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockCreateGateway,
  mockCreateOpenAICompatible,
  mockDbSelect,
  mockDbSelectLimit,
  mockDecryptCredential,
  mockFetch,
  mockGetUpstashRedis,
  mockRedisDel,
  mockRedisGet,
  mockRedisSet,
} = vi.hoisted(() => {
  const mockCreateGateway = vi.fn()
  const mockCreateOpenAICompatible = vi.fn()
  const mockDecryptCredential = vi.fn()
  const mockFetch = vi.fn()
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
    mockCreateOpenAICompatible,
    mockDbSelect,
    mockDbSelectLimit,
    mockDecryptCredential,
    mockFetch,
    mockGetUpstashRedis,
    mockRedisDel,
    mockRedisGet,
    mockRedisSet,
  }
})

vi.mock('server-only', () => ({}))

vi.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: mockCreateOpenAICompatible,
}))

vi.mock('ai', () => ({
  createGateway: mockCreateGateway,
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
import { verifyInferenceCredential } from './inference-provider-verify'
import { getUserLanguageModel } from './inference-providers'

describe('inference-providers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', mockFetch)
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
    mockCreateOpenAICompatible.mockImplementation(
      ({ apiKey, name }: { apiKey: string; name: string }) =>
        (modelId: string) => ({
          apiKey,
          kind: name,
          modelId,
        })
    )
  })

  it('skips network verification for LLM Gateway credentials', async () => {
    await expect(
      verifyInferenceCredential({
        apiKey: 'llmgtwy_secret',
        inferenceProvider: 'llm-gateway',
      })
    ).resolves.toMatchObject({
      providerStatus: 'verification_skipped',
      verification: {
        reason: 'no_non_billable_verification_endpoint',
      },
    })

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('creates an LLM Gateway language model from the saved user key', async () => {
    await expect(
      getUserLanguageModel({
        inferenceProvider: 'llm-gateway',
        modelId: 'gpt-5-mini',
        userId: 'user_123',
      })
    ).resolves.toEqual({
      apiKey: 'provider_secret',
      kind: 'llmgateway',
      modelId: 'gpt-5-mini',
    })

    expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
      apiKey: 'provider_secret',
      baseURL: 'https://api.llmgateway.io/v1',
      name: 'llmgateway',
    })
    expect(mockRedisSet).toHaveBeenCalledWith(
      'user:user_123:provider:llm-gateway:inference-credential',
      {
        encrypted: 'enc_from_db',
        status: 'enabled',
      }
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
      {
        encrypted: 'enc_from_db',
        status: 'enabled',
      }
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

    expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
      apiKey: 'provider_secret',
      baseURL: 'https://openrouter.ai/api/v1',
      headers: {
        'X-OpenRouter-Title': 'OUTNA.ME',
      },
      name: 'openrouter',
      transformRequestBody: expect.any(Function),
    })
  })

  it('uses cached encrypted credentials before querying the database', async () => {
    mockRedisGet.mockResolvedValue({
      encrypted: 'enc_from_cache',
      status: 'enabled',
    })

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

  it('ignores cached credentials when the cached status is not enabled', async () => {
    mockRedisGet.mockResolvedValue({
      encrypted: 'enc_from_cache',
      status: 'invalid',
    })
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

    expect(mockDbSelect).toHaveBeenCalled()
    expect(mockDecryptCredential).not.toHaveBeenCalled()
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
