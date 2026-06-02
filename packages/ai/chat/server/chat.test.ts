import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  insertOnConflictDoNothing: vi.fn(),
  insertReturning: vi.fn(),
  insertValues: vi.fn(),
  select: vi.fn(),
  selectFrom: vi.fn(),
  selectLimit: vi.fn(),
  selectWhere: vi.fn(),
  update: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@outname/db', () => ({
  db: {
    insert: mocks.insert,
    select: mocks.select,
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
    mocks.select.mockReturnValue({ from: mocks.selectFrom })
    mocks.selectFrom.mockReturnValue({ where: mocks.selectWhere })
    mocks.selectWhere.mockReturnValue({ limit: mocks.selectLimit })
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

  it('exposes insertChatMessage as an explicit idempotent boolean wrapper', async () => {
    mocks.insertReturning.mockResolvedValueOnce([])

    const { insertChatMessage } = await import('./chat')
    const inserted = await insertChatMessage({
      conversationId: 'conv_123',
      id: 'msg_123',
      parts: [{ text: 'hello', type: 'text' }],
      role: 'user',
    })

    expect(inserted).toBe(false)
    expect(mocks.update).not.toHaveBeenCalled()
  })
})

describe('upsertChatMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.insert.mockReturnValue({ values: mocks.insertValues })
    mocks.insertValues.mockReturnValue({
      onConflictDoNothing: mocks.insertOnConflictDoNothing,
    })
    mocks.insertOnConflictDoNothing.mockReturnValue({
      returning: mocks.insertReturning,
    })
    mocks.select.mockReturnValue({ from: mocks.selectFrom })
    mocks.selectFrom.mockReturnValue({ where: mocks.selectWhere })
    mocks.selectWhere.mockReturnValue({ limit: mocks.selectLimit })
    mocks.update.mockReturnValue({ set: mocks.updateSet })
    mocks.updateSet.mockReturnValue({ where: mocks.updateWhere })
    mocks.updateWhere.mockResolvedValue(undefined)
  })

  it('returns inserted when the insert wins', async () => {
    mocks.insertReturning.mockResolvedValueOnce([{ id: 'msg_123' }])

    const { upsertChatMessage } = await import('./chat')
    const result = await upsertChatMessage({
      conversationId: 'conv_123',
      id: 'msg_123',
      parts: [{ text: 'hello', type: 'text' }],
      role: 'user',
    })

    expect(result).toBe('inserted')
    expect(mocks.select).not.toHaveBeenCalled()
    expect(mocks.update).toHaveBeenCalledTimes(1)
  })

  it('updates changed existing provider messages without changing createdAt', async () => {
    mocks.insertReturning.mockResolvedValueOnce([])
    mocks.selectLimit.mockResolvedValueOnce([
      {
        conversationId: 'conv_123',
        metadata: { providerMetadata: { edited: false } },
        parts: [{ text: 'old', type: 'text' }],
        role: 'user',
      },
    ])

    const { upsertChatMessage } = await import('./chat')
    const result = await upsertChatMessage({
      conversationId: 'conv_123',
      createdAt: new Date('2024-03-09T16:00:00.000Z'),
      id: 'msg_123',
      metadata: { providerMetadata: { edited: true } },
      parts: [{ text: 'new', type: 'text' }],
      role: 'user',
    })

    expect(result).toBe('updated')
    expect(mocks.updateSet).toHaveBeenCalledWith({
      metadata: { providerMetadata: { edited: true } },
      parts: [{ text: 'new', type: 'text' }],
      role: 'user',
    })
    expect(mocks.update).toHaveBeenCalledTimes(2)
  })

  it('returns unchanged for duplicate provider messages with equivalent JSON', async () => {
    mocks.insertReturning.mockResolvedValueOnce([])
    mocks.selectLimit.mockResolvedValueOnce([
      {
        conversationId: 'conv_123',
        metadata: { b: 2, a: 1 },
        parts: [{ text: 'hello', type: 'text' }],
        role: 'user',
      },
    ])

    const { upsertChatMessage } = await import('./chat')
    const result = await upsertChatMessage({
      conversationId: 'conv_123',
      id: 'msg_123',
      metadata: { a: 1, b: 2 },
      parts: [{ text: 'hello', type: 'text' }],
      role: 'user',
    })

    expect(result).toBe('unchanged')
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
