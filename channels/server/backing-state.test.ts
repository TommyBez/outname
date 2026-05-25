import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createRedisState: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@chat-adapter/state-redis', () => ({
  createRedisState: mocks.createRedisState,
}))

describe('createChannelRedisState', () => {
  const originalRedisUrl = process.env.REDIS_URL

  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.REDIS_URL
  })

  afterEach(() => {
    if (originalRedisUrl === undefined) {
      delete process.env.REDIS_URL
    } else {
      process.env.REDIS_URL = originalRedisUrl
    }
  })

  it('throws when REDIS_URL is missing', async () => {
    const { createChannelRedisState } = await import('./backing-state')

    expect(() => createChannelRedisState()).toThrow(
      'REDIS_URL is required for channel Chat SDK state.'
    )
    expect(mocks.createRedisState).not.toHaveBeenCalled()
  })

  it('uses the shared channel Redis key prefix', async () => {
    const adapter = { connect: vi.fn() }
    process.env.REDIS_URL = 'redis://localhost:6379'
    mocks.createRedisState.mockReturnValue(adapter)

    const { createChannelRedisState } = await import('./backing-state')

    expect(createChannelRedisState()).toBe(adapter)
    expect(mocks.createRedisState).toHaveBeenCalledWith({
      keyPrefix: 'channels-chat-sdk',
      url: 'redis://localhost:6379',
    })
  })
})
