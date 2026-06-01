import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockCreateGateway,
  mockDecryptCredential,
  mockDbSelect,
  mockDbSelectLimit,
  mockDbUpdate,
  mockDbUpdateSet,
  mockDbUpdateWhere,
  mockEncryptCredential,
  mockGetUpstashRedis,
  mockRedisDel,
  mockRedisGet,
  mockRedisSet,
} = vi.hoisted(() => {
  const mockRedisGet = vi.fn()
  const mockRedisSet = vi.fn()
  const mockRedisDel = vi.fn()
  const mockCreateGateway = vi.fn()
  const mockEncryptCredential = vi.fn()
  const mockDecryptCredential = vi.fn()

  const mockDbSelectLimit = vi.fn()
  const mockDbSelectWhere = vi.fn(() => ({ limit: mockDbSelectLimit }))
  const mockDbSelectFrom = vi.fn(() => ({ where: mockDbSelectWhere }))
  const mockDbSelect = vi.fn(() => ({ from: mockDbSelectFrom }))

  const mockDbUpdateWhere = vi.fn()
  const mockDbUpdateSet = vi.fn(() => ({ where: mockDbUpdateWhere }))
  const mockDbUpdate = vi.fn(() => ({ set: mockDbUpdateSet }))

  const mockGetUpstashRedis = vi.fn<
    () => {
      del: typeof mockRedisDel
      get: typeof mockRedisGet
      set: typeof mockRedisSet
    } | null
  >(() => ({
    del: mockRedisDel,
    get: mockRedisGet,
    set: mockRedisSet,
  }))

  return {
    mockCreateGateway,
    mockDecryptCredential,
    mockDbSelect,
    mockDbSelectLimit,
    mockDbUpdate,
    mockDbUpdateSet,
    mockDbUpdateWhere,
    mockEncryptCredential,
    mockGetUpstashRedis,
    mockRedisDel,
    mockRedisGet,
    mockRedisSet,
  }
})

vi.mock('ai', () => ({
  createGateway: mockCreateGateway,
}))

vi.mock('server-only', () => ({}))

vi.mock('@outname/shared/connections/crypto', () => ({
  decryptCredential: mockDecryptCredential,
  encryptCredential: mockEncryptCredential,
}))

vi.mock('@outname/db', () => ({
  db: {
    select: mockDbSelect,
    update: mockDbUpdate,
  },
}))

vi.mock('@outname/shared/server/upstash-redis', () => ({
  getUpstashRedis: mockGetUpstashRedis,
}))

import {
  clearUserAiGatewayApiKey,
  getUserModelForGateway,
  setUserAiGatewayApiKey,
} from './ai-gateway-byok'

const AI_GATEWAY_CACHE_KEY = 'user:user_123:ai-gateway-api-key'

describe('ai-gateway-byok', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockDbSelectLimit.mockResolvedValue([])
    mockDbUpdateWhere.mockResolvedValue(undefined)
    mockRedisGet.mockResolvedValue(null)
    mockRedisSet.mockResolvedValue('OK')
    mockRedisDel.mockResolvedValue(1)
    mockEncryptCredential.mockResolvedValue('enc_default')
    mockDecryptCredential.mockResolvedValue({ apiKey: 'vck_default' })
    mockCreateGateway.mockImplementation(
      ({ apiKey }: { apiKey: string }) =>
        (modelId: string) => ({
          apiKey,
          modelId,
        })
    )
    mockGetUpstashRedis.mockReturnValue({
      del: mockRedisDel,
      get: mockRedisGet,
      set: mockRedisSet,
    })
  })

  it('writes the encrypted key through to Postgres and Redis', async () => {
    mockEncryptCredential.mockResolvedValue('enc_saved')

    await setUserAiGatewayApiKey({
      apiKey: '  vck_secret  ',
      userId: 'user_123',
    })

    expect(mockEncryptCredential).toHaveBeenCalledWith({ apiKey: 'vck_secret' })
    expect(mockDbUpdateSet).toHaveBeenCalledWith({
      aiGatewayApiKey: 'enc_saved',
    })
    expect(mockRedisSet).toHaveBeenCalledWith(AI_GATEWAY_CACHE_KEY, 'enc_saved')
    expect(mockRedisSet).not.toHaveBeenCalledWith(
      AI_GATEWAY_CACHE_KEY,
      'vck_secret'
    )
  })

  it('uses the Redis mirror before querying Postgres', async () => {
    mockRedisGet.mockResolvedValue('enc_cached')
    mockDecryptCredential.mockResolvedValue({ apiKey: 'vck_cached' })

    await expect(
      getUserModelForGateway({
        modelId: 'openai/gpt-5.4-nano',
        userId: 'user_123',
      })
    ).resolves.toEqual({
      apiKey: 'vck_cached',
      modelId: 'openai/gpt-5.4-nano',
    })

    expect(mockDbSelect).not.toHaveBeenCalled()
    expect(mockRedisSet).not.toHaveBeenCalled()
  })

  it('hydrates Redis from Postgres on cache miss', async () => {
    mockDbSelectLimit.mockResolvedValue([{ aiGatewayApiKey: 'enc_from_db' }])
    mockDecryptCredential.mockResolvedValue({ apiKey: 'vck_from_db' })

    await expect(
      getUserModelForGateway({
        modelId: 'openai/gpt-5.4-nano',
        userId: 'user_123',
      })
    ).resolves.toEqual({
      apiKey: 'vck_from_db',
      modelId: 'openai/gpt-5.4-nano',
    })

    expect(mockDbSelect).toHaveBeenCalledTimes(1)
    expect(mockRedisSet).toHaveBeenCalledWith(
      AI_GATEWAY_CACHE_KEY,
      'enc_from_db'
    )
  })

  it('clears the Redis mirror when removing the saved key', async () => {
    await clearUserAiGatewayApiKey('user_123')

    expect(mockDbUpdateSet).toHaveBeenCalledWith({ aiGatewayApiKey: null })
    expect(mockRedisDel).toHaveBeenCalledWith(AI_GATEWAY_CACHE_KEY)
  })

  it('falls back to Postgres when Redis is unavailable', async () => {
    mockGetUpstashRedis.mockReturnValue(null)
    mockDbSelectLimit.mockResolvedValue([{ aiGatewayApiKey: 'enc_from_db' }])
    mockDecryptCredential.mockResolvedValue({ apiKey: 'vck_from_db' })

    await expect(
      getUserModelForGateway({
        modelId: 'openai/gpt-5.4-nano',
        userId: 'user_123',
      })
    ).resolves.toEqual({
      apiKey: 'vck_from_db',
      modelId: 'openai/gpt-5.4-nano',
    })

    expect(mockDbSelect).toHaveBeenCalledTimes(1)
    expect(mockRedisGet).not.toHaveBeenCalled()
    expect(mockRedisSet).not.toHaveBeenCalled()
  })
})
