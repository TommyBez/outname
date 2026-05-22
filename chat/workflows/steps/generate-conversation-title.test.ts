import type { UIMessage } from 'ai'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  generateText: vi.fn(),
  getConversationForAgent: vi.fn(),
  getUserModelForGateway: vi.fn(),
  revalidateTag: vi.fn(),
  selectLimit: vi.fn(),
  setConversationTitleIfUnset: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('ai', () => ({
  generateText: mocks.generateText,
}))

vi.mock('next/cache', () => ({
  revalidateTag: mocks.revalidateTag,
}))

vi.mock('@/chat/server/chat', () => ({
  getConversationForAgent: mocks.getConversationForAgent,
  setConversationTitleIfUnset: mocks.setConversationTitleIfUnset,
}))

vi.mock('@/shared/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: mocks.selectLimit,
        })),
      })),
    })),
  },
}))

vi.mock('@/shared/server/ai-gateway-byok', () => ({
  getUserModelForGateway: mocks.getUserModelForGateway,
}))

vi.mock('@/shared/server/cache-tags', () => ({
  conversationListTag: (agentId: string) => `conversation-list:${agentId}`,
}))

describe('maybeGenerateConversationTitle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getConversationForAgent.mockResolvedValue({
      id: 'conv_123',
      title: null,
    })
    mocks.getUserModelForGateway.mockResolvedValue('title-model')
    mocks.selectLimit.mockResolvedValue([{ userId: 'user_123' }])
    mocks.setConversationTitleIfUnset.mockResolvedValue(undefined)
  })

  it('does not persist a title for greeting-only conversations', async () => {
    const { maybeGenerateConversationTitle } = await import(
      './generate-conversation-title'
    )

    await maybeGenerateConversationTitle({
      agentId: 'agent_123',
      conversationId: 'conv_123',
      uiMessages: [userMessage('Ciao!')],
    })

    expect(mocks.generateText).not.toHaveBeenCalled()
    expect(mocks.setConversationTitleIfUnset).not.toHaveBeenCalled()
    expect(mocks.revalidateTag).not.toHaveBeenCalled()
  })

  it('uses the first substantive user message after an initial greeting', async () => {
    mocks.generateText.mockResolvedValue({
      text: 'Realtime Agent Refactor',
    })
    const { maybeGenerateConversationTitle } = await import(
      './generate-conversation-title'
    )

    await maybeGenerateConversationTitle({
      agentId: 'agent_123',
      conversationId: 'conv_123',
      uiMessages: [
        userMessage('ciao'),
        assistantMessage('Ciao, dimmi pure.'),
        userMessage('Spiegami il refactor realtime degli agenti'),
      ],
    })

    expect(mocks.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'Spiegami il refactor realtime degli agenti',
      })
    )
    expect(mocks.setConversationTitleIfUnset).toHaveBeenCalledWith(
      'conv_123',
      'Realtime Agent Refactor'
    )
  })

  it('generates a title from content that follows a leading greeting', async () => {
    mocks.generateText.mockResolvedValue({
      text: 'Spring Poem',
    })
    const { maybeGenerateConversationTitle } = await import(
      './generate-conversation-title'
    )

    await maybeGenerateConversationTitle({
      agentId: 'agent_123',
      conversationId: 'conv_123',
      uiMessages: [userMessage('ciao, scrivi una poesia sulla primavera')],
    })

    expect(mocks.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'scrivi una poesia sulla primavera',
      })
    )
    expect(mocks.setConversationTitleIfUnset).toHaveBeenCalledWith(
      'conv_123',
      'Spring Poem'
    )
  })

  it('does not persist the placeholder New Chat returned by the title model', async () => {
    mocks.generateText.mockResolvedValue({
      text: 'New Chat',
    })
    const { maybeGenerateConversationTitle } = await import(
      './generate-conversation-title'
    )

    await maybeGenerateConversationTitle({
      agentId: 'agent_123',
      conversationId: 'conv_123',
      uiMessages: [userMessage('Spiegami il refactor realtime degli agenti')],
    })

    expect(mocks.setConversationTitleIfUnset).toHaveBeenCalledWith(
      'conv_123',
      'Spiegami il refactor realtime degli agenti'
    )
  })

  it('treats an existing New Chat title as replaceable placeholder', async () => {
    mocks.getConversationForAgent.mockResolvedValue({
      id: 'conv_123',
      title: 'New Chat',
    })
    mocks.generateText.mockResolvedValue({
      text: 'Realtime Agent Refactor',
    })
    const { maybeGenerateConversationTitle } = await import(
      './generate-conversation-title'
    )

    await maybeGenerateConversationTitle({
      agentId: 'agent_123',
      conversationId: 'conv_123',
      uiMessages: [userMessage('Spiegami il refactor realtime degli agenti')],
    })

    expect(mocks.setConversationTitleIfUnset).toHaveBeenCalledWith(
      'conv_123',
      'Realtime Agent Refactor'
    )
  })
})

function userMessage(text: string): UIMessage {
  return {
    id: `msg_user_${text}`,
    parts: [{ text, type: 'text' }],
    role: 'user',
  }
}

function assistantMessage(text: string): UIMessage {
  return {
    id: `msg_assistant_${text}`,
    parts: [{ text, type: 'text' }],
    role: 'assistant',
  }
}
