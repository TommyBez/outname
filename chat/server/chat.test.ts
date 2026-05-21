import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  insertOnConflictDoNothing: vi.fn(),
  insertReturning: vi.fn(),
  insertValues: vi.fn(),
  update: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@/shared/db', () => ({
  db: {
    insert: mocks.insert,
    update: mocks.update,
  },
}))

describe('insertChatMessageIfNew', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.insert.mockReturnValue({ values: mocks.insertValues })
    mocks.insertValues.mockReturnValue({
      onConflictDoNothing: mocks.insertOnConflictDoNothing,
    })
    mocks.insertOnConflictDoNothing.mockReturnValue({
      returning: mocks.insertReturning,
    })
    mocks.update.mockReturnValue({ set: mocks.updateSet })
    mocks.updateSet.mockReturnValue({ where: mocks.updateWhere })
    mocks.updateWhere.mockResolvedValue(undefined)
  })

  it('returns true and touches the conversation only when the insert wins', async () => {
    mocks.insertReturning.mockResolvedValueOnce([{ id: 'msg_123' }])

    const { insertChatMessageIfNew } = await import('./chat')
    const inserted = await insertChatMessageIfNew({
      conversationId: 'conv_123',
      id: 'msg_123',
      parts: [{ text: 'hello', type: 'text' }],
      role: 'user',
    })

    expect(inserted).toBe(true)
    expect(mocks.update).toHaveBeenCalledTimes(1)
    expect(mocks.updateWhere).toHaveBeenCalledTimes(1)
  })

  it('returns false and skips conversation updatedAt when the message already exists', async () => {
    mocks.insertReturning.mockResolvedValueOnce([])

    const { insertChatMessageIfNew } = await import('./chat')
    const inserted = await insertChatMessageIfNew({
      conversationId: 'conv_123',
      id: 'msg_123',
      parts: [{ text: 'hello', type: 'text' }],
      role: 'user',
    })

    expect(inserted).toBe(false)
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('is race-safe for duplicate concurrent inserts by relying on ON CONFLICT DO NOTHING RETURNING id', async () => {
    mocks.insertReturning
      .mockResolvedValueOnce([{ id: 'msg_123' }])
      .mockResolvedValueOnce([])

    const { insertChatMessageIfNew } = await import('./chat')
    const [first, second] = await Promise.all([
      insertChatMessageIfNew({
        conversationId: 'conv_123',
        id: 'msg_123',
        parts: [{ text: 'hello', type: 'text' }],
        role: 'user',
      }),
      insertChatMessageIfNew({
        conversationId: 'conv_123',
        id: 'msg_123',
        parts: [{ text: 'hello again', type: 'text' }],
        role: 'user',
      }),
    ])

    expect([first, second]).toEqual([true, false])
    expect(mocks.insertOnConflictDoNothing).toHaveBeenCalledTimes(2)
    expect(mocks.insertReturning).toHaveBeenCalledTimes(2)
    expect(mocks.update).toHaveBeenCalledTimes(1)
  })
})
