import type { Lock, QueueEntry, StateAdapter } from 'chat'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  deleteSlackInstallation: vi.fn(),
  loadSlackInstallationByTeam: vi.fn(),
  saveSlackInstallation: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('./installations', () => ({
  deleteSlackInstallation: mocks.deleteSlackInstallation,
  loadSlackInstallationByTeam: mocks.loadSlackInstallationByTeam,
  saveSlackInstallation: mocks.saveSlackInstallation,
}))

describe('SlackHybridState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('delegates non-installation Chat SDK state to the inner adapter', async () => {
    const inner = buildInnerState()
    const { SlackHybridState } = await import('./state')
    const state = new SlackHybridState(inner as unknown as StateAdapter)
    const lock = { token: 'lock_123' } as Lock
    inner.acquireLock.mockResolvedValue(lock)

    await state.set('thread:T123', { value: 1 }, 1000)
    await state.enqueue(
      'thread:T123',
      { id: 'queue_1' } as unknown as QueueEntry,
      10
    )
    const acquired = await state.acquireLock('thread:T123', 5000)

    expect(inner.set).toHaveBeenCalledWith('thread:T123', { value: 1 }, 1000)
    expect(inner.enqueue).toHaveBeenCalledWith(
      'thread:T123',
      { id: 'queue_1' },
      10
    )
    expect(acquired).toBe(lock)
    expect(mocks.saveSlackInstallation).not.toHaveBeenCalled()
  })

  it('stores Slack installation keys in Postgres with install context', async () => {
    const inner = buildInnerState()
    const { SlackHybridState, withInstallContext } = await import('./state')
    const state = new SlackHybridState(inner as unknown as StateAdapter)
    const installation = { bot: { token: 'xoxb-token' } }

    await withInstallContext({ userId: 'user_123' }, async () => {
      await state.set('slack:installation:T123', installation)
    })

    expect(mocks.saveSlackInstallation).toHaveBeenCalledWith({
      installation,
      teamId: 'T123',
      userId: 'user_123',
    })
    expect(inner.set).not.toHaveBeenCalled()
  })
})

function buildInnerState(): MockStateAdapter {
  return {
    acquireLock: vi.fn(),
    appendToList: vi.fn(),
    connect: vi.fn(),
    delete: vi.fn(),
    dequeue: vi.fn(),
    disconnect: vi.fn(),
    enqueue: vi.fn(),
    extendLock: vi.fn(),
    forceReleaseLock: vi.fn(),
    get: vi.fn(),
    getList: vi.fn(),
    isSubscribed: vi.fn(),
    queueDepth: vi.fn(),
    releaseLock: vi.fn(),
    set: vi.fn(),
    setIfNotExists: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  } as unknown as MockStateAdapter
}

type MockStateAdapter = {
  [K in keyof StateAdapter]: StateAdapter[K] extends (
    ...args: infer Args
  ) => infer Return
    ? ReturnType<typeof vi.fn<(...args: Args) => Return>>
    : StateAdapter[K]
}
