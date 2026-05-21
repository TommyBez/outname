import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createRedisState: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@chat-adapter/state-redis', () => ({
  createRedisState: mocks.createRedisState,
}))

describe('createSlackBackingState', () => {
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

  it('throws immediately when REDIS_URL is missing', async () => {
    const { createSlackBackingState } = await import('./backing-state')

    expect(() => createSlackBackingState()).toThrow(
      'REDIS_URL is required for Slack Chat SDK state.'
    )
    expect(mocks.createRedisState).not.toHaveBeenCalled()
  })

  it('creates Redis-backed Chat SDK state when REDIS_URL exists', async () => {
    const adapter = { connect: vi.fn() }
    process.env.REDIS_URL = 'redis://localhost:6379'
    mocks.createRedisState.mockReturnValue(adapter)

    const { createSlackBackingState } = await import('./backing-state')

    expect(createSlackBackingState()).toBe(adapter)
    expect(mocks.createRedisState).toHaveBeenCalledWith({
      keyPrefix: 'slack-chat-sdk',
      url: 'redis://localhost:6379',
    })
  })
})
