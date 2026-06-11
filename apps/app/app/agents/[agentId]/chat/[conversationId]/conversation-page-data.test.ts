import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCachedAgentByIdForUser: vi.fn(),
  getConversationForAgent: vi.fn(),
  loadChatHistory: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@outname/shared/server/data', () => ({
  getCachedAgentByIdForUser: mocks.getCachedAgentByIdForUser,
}))

vi.mock('@outname/ai/chat/server/chat', () => ({
  getConversationForAgent: mocks.getConversationForAgent,
  loadChatHistory: mocks.loadChatHistory,
}))

import { loadConversationPageData } from './conversation-page-data'

describe('loadConversationPageData', () => {
  beforeEach(() => {
    mocks.getCachedAgentByIdForUser.mockReset()
    mocks.getConversationForAgent.mockReset()
    mocks.loadChatHistory.mockReset()
  })

  it('returns null without loading history when the agent is missing', async () => {
    mocks.getCachedAgentByIdForUser.mockResolvedValue(null)

    const result = await loadConversationPageData({
      agentId: 'agent-1',
      conversationId: 'conversation-1',
      userId: 'user-1',
    })

    expect(result).toBeNull()
    expect(mocks.getConversationForAgent).not.toHaveBeenCalled()
    expect(mocks.loadChatHistory).not.toHaveBeenCalled()
  })

  it('returns null without loading history when the conversation is not owned', async () => {
    mocks.getCachedAgentByIdForUser.mockResolvedValue({ id: 'agent-1' })
    mocks.getConversationForAgent.mockResolvedValue(null)

    const result = await loadConversationPageData({
      agentId: 'agent-1',
      conversationId: 'conversation-1',
      userId: 'user-1',
    })

    expect(result).toBeNull()
    expect(mocks.getConversationForAgent).toHaveBeenCalledWith(
      'conversation-1',
      'agent-1'
    )
    expect(mocks.loadChatHistory).not.toHaveBeenCalled()
  })

  it('loads history only after the ownership check passes', async () => {
    const initialMessages = [{ id: 'msg-1', role: 'user', parts: [] }]

    mocks.getCachedAgentByIdForUser.mockResolvedValue({ id: 'agent-1' })
    mocks.getConversationForAgent.mockResolvedValue({ id: 'conversation-1' })
    mocks.loadChatHistory.mockResolvedValue(initialMessages)

    const result = await loadConversationPageData({
      agentId: 'agent-1',
      conversationId: 'conversation-1',
      userId: 'user-1',
    })

    expect(mocks.loadChatHistory).toHaveBeenCalledWith('conversation-1')
    expect(result).toEqual({
      agentId: 'agent-1',
      conversationId: 'conversation-1',
      initialMessages,
    })
  })
})
