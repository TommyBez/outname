import type { ModelMessage } from 'ai'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Agent } from '@/shared/db/schema'
import type { ChannelReplySink, IncomingChannelMessage } from './types'

const mocks = vi.hoisted(() => ({
  ensureConversationForThread: vi.fn(),
  insertChatMessageIfNew: vi.fn(),
  revalidateTag: vi.fn(),
  resolveRoutesForIncomingMessage: vi.fn(),
  runRealtimeChatTurn: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('next/cache', () => ({
  revalidateTag: mocks.revalidateTag,
}))

vi.mock('@/agent-runtime/server/realtime-chat-runner', () => ({
  runRealtimeChatTurn: mocks.runRealtimeChatTurn,
}))

vi.mock('@/chat/server/chat', () => ({
  insertChatMessageIfNew: mocks.insertChatMessageIfNew,
}))

vi.mock('@/shared/server/cache-tags', () => ({
  conversationListTag: (agentId: string) => `conversation-list:${agentId}`,
}))

vi.mock('./routing', () => ({
  ensureConversationForThread: mocks.ensureConversationForThread,
  resolveRoutesForIncomingMessage: mocks.resolveRoutesForIncomingMessage,
}))

describe('runChannelChatTurn', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('continues sequential fan-out when one realtime agent turn fails', async () => {
    const firstAgent = buildAgent({
      id: 'agent_alpha',
      name: 'Alpha',
      userId: 'user_alpha',
    })
    const secondAgent = buildAgent({
      id: 'agent_beta',
      name: 'Beta',
      userId: 'user_beta',
    })

    mockRoutes(firstAgent, secondAgent)
    mocks.insertChatMessageIfNew.mockResolvedValue(true)
    mocks.runRealtimeChatTurn
      .mockRejectedValueOnce(new Error('model failed'))
      .mockResolvedValueOnce(undefined)

    const sink = buildSink()
    const handled = await runChannelChatTurn({
      message: buildSlackMessage(),
      sink,
    })

    expect(handled).toBe(true)
    expect(mocks.runRealtimeChatTurn).toHaveBeenCalledTimes(2)
    expect(mocks.runRealtimeChatTurn.mock.calls[0][0].agentId).toBe(
      firstAgent.id
    )
    expect(mocks.runRealtimeChatTurn.mock.calls[1][0].agentId).toBe(
      secondAgent.id
    )
    expect(sink.postError).toHaveBeenCalledWith(
      'Agent "Alpha" failed while processing this message. Continuing with the remaining agents.'
    )
  })

  it('keeps multi-agent fan-out sequential', async () => {
    const firstAgent = buildAgent({
      id: 'agent_alpha',
      name: 'Alpha',
      userId: 'user_alpha',
    })
    const secondAgent = buildAgent({
      id: 'agent_beta',
      name: 'Beta',
      userId: 'user_beta',
    })
    let releaseFirst: () => void = () => {
      throw new Error('first turn did not start')
    }
    let resolveFirstStarted: () => void = () => {
      throw new Error('first turn did not start')
    }
    const firstStarted = new Promise<void>((resolve) => {
      resolveFirstStarted = resolve
    })
    const order: string[] = []

    mockRoutes(firstAgent, secondAgent)
    mocks.insertChatMessageIfNew.mockResolvedValue(true)
    mocks.runRealtimeChatTurn.mockImplementation(
      async ({ agentId }: { agentId: string }) => {
        order.push(`${agentId}:start`)
        if (agentId === firstAgent.id) {
          resolveFirstStarted()
          await new Promise<void>((resolve) => {
            releaseFirst = () => {
              order.push(`${agentId}:end`)
              resolve()
            }
          })
          return
        }
        order.push(`${agentId}:end`)
      }
    )

    const turnPromise = runChannelChatTurn({
      message: buildSlackMessage(),
      sink: buildSink(),
    })
    await firstStarted

    expect(order).toEqual(['agent_alpha:start'])
    releaseFirst()
    await turnPromise

    expect(order).toEqual([
      'agent_alpha:start',
      'agent_alpha:end',
      'agent_beta:start',
      'agent_beta:end',
    ])
  })

  it('persists skipped messages before the current message with canonical createdAt', async () => {
    const agent = buildAgent({
      id: 'agent_alpha',
      name: 'Alpha',
      userId: 'user_alpha',
    })
    const skipped = [
      buildSlackMessage({
        createdAt: new Date('2024-03-09T16:00:00.100Z'),
        externalMessageKey: 'slack-message-1',
        text: 'first',
      }),
      buildSlackMessage({
        createdAt: new Date('2024-03-09T16:00:01.200Z'),
        externalMessageKey: 'slack-message-2',
        text: 'second',
      }),
    ]
    const current = buildSlackMessage({
      createdAt: new Date('2024-03-09T16:00:02.300Z'),
      externalMessageKey: 'slack-message-3',
      skipped,
      text: 'third',
    })

    mockRoutes(agent)
    mocks.insertChatMessageIfNew.mockResolvedValue(true)
    mocks.runRealtimeChatTurn.mockResolvedValue(undefined)

    await runChannelChatTurn({ message: current, sink: buildSink() })

    expect(mocks.insertChatMessageIfNew).toHaveBeenCalledTimes(3)
    const calls = mocks.insertChatMessageIfNew.mock.calls.map(
      ([input]) => input
    )
    expect(calls.map((call) => call.parts[0].text)).toEqual([
      'first',
      'second',
      'third',
    ])
    expect(calls.map((call) => call.createdAt.toISOString())).toEqual([
      '2024-03-09T16:00:00.100Z',
      '2024-03-09T16:00:01.200Z',
      '2024-03-09T16:00:02.300Z',
    ])
  })

  it('derives the same user message id from the same external message key and agent', async () => {
    const agent = buildAgent({
      id: 'agent_alpha',
      name: 'Alpha',
      userId: 'user_alpha',
    })

    mockRoutes(agent)
    mocks.insertChatMessageIfNew.mockResolvedValue(true)
    mocks.runRealtimeChatTurn.mockResolvedValue(undefined)

    await runChannelChatTurn({
      message: buildSlackMessage({ externalMessageKey: 'same-platform-id' }),
      sink: buildSink(),
    })
    await runChannelChatTurn({
      message: buildSlackMessage({ externalMessageKey: 'same-platform-id' }),
      sink: buildSink(),
    })

    const calls = mocks.insertChatMessageIfNew.mock.calls.map(
      ([input]) => input
    )
    expect(calls[0].id).toBe(calls[1].id)
  })

  it('derives distinct user message ids from the same external message key for different agents', async () => {
    const firstAgent = buildAgent({
      id: 'agent_alpha',
      name: 'Alpha',
      userId: 'user_alpha',
    })
    const secondAgent = buildAgent({
      id: 'agent_beta',
      name: 'Beta',
      userId: 'user_beta',
    })

    mockRoutes(firstAgent, secondAgent)
    mocks.insertChatMessageIfNew.mockResolvedValue(true)
    mocks.runRealtimeChatTurn.mockResolvedValue(undefined)

    await runChannelChatTurn({
      message: buildSlackMessage({ externalMessageKey: 'same-platform-id' }),
      sink: buildSink(),
    })

    const calls = mocks.insertChatMessageIfNew.mock.calls.map(
      ([input]) => input
    )
    expect(calls[0].id).not.toBe(calls[1].id)
  })

  it('loads model messages once for multi-agent fan-out', async () => {
    const firstAgent = buildAgent({
      id: 'agent_alpha',
      name: 'Alpha',
      userId: 'user_alpha',
    })
    const secondAgent = buildAgent({
      id: 'agent_beta',
      name: 'Beta',
      userId: 'user_beta',
    })
    const loadedMessages: ModelMessage[] = [
      { content: 'history', role: 'user' },
    ]
    const loadModelMessages = vi.fn(async () => loadedMessages)

    mockRoutes(firstAgent, secondAgent)
    mocks.insertChatMessageIfNew.mockResolvedValue(true)
    mocks.runRealtimeChatTurn.mockResolvedValue(undefined)

    await runChannelChatTurn({
      message: buildSlackMessage({ loadModelMessages }),
      sink: buildSink(),
    })

    expect(loadModelMessages).toHaveBeenCalledTimes(1)
    expect(mocks.runRealtimeChatTurn.mock.calls[0][0].messages).toBe(
      loadedMessages
    )
    expect(mocks.runRealtimeChatTurn.mock.calls[1][0].messages).toBe(
      loadedMessages
    )
  })
})

function mockRoutes(...agents: Agent[]): void {
  mocks.resolveRoutesForIncomingMessage.mockResolvedValue(
    agents.map((agent, index) => ({
      agent,
      installationCreatedAt: new Date(
        `2026-05-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`
      ),
      installationUserId: agent.userId,
    }))
  )
  mocks.ensureConversationForThread.mockImplementation(
    async ({ agent }: { agent: Agent }) => ({
      agent,
      conversationId: `conv_${agent.id}`,
      installationCreatedAt: new Date('2026-05-01T00:00:00.000Z'),
      installationUserId: agent.userId,
    })
  )
}

function buildAgent(input: {
  id: string
  name: string
  userId: string
}): Agent {
  return {
    enabled: true,
    id: input.id,
    name: input.name,
    userId: input.userId,
  } as unknown as Agent
}

function buildSlackMessage(
  input: {
    createdAt?: Date
    externalMessageKey?: string
    loadModelMessages?: () => Promise<ModelMessage[] | undefined>
    skipped?: IncomingChannelMessage[]
    text?: string
  } = {}
): IncomingChannelMessage {
  return {
    channel: 'slack',
    createdAt: input.createdAt ?? new Date('2024-03-09T16:00:00.123Z'),
    externalMessageKey: input.externalMessageKey ?? 'slack-message-1',
    externalRoutingKey: 'C123',
    externalRoutingKind: 'channel',
    externalThreadKey: 'C123:1710000000.123456',
    externalUserDisplayName: 'Slack User',
    externalUserId: 'U123',
    loadModelMessages: input.loadModelMessages,
    skipped: input.skipped,
    teamId: 'T123',
    text: input.text ?? 'hello',
    threadMetadata: {
      slackChannel: 'C123',
      slackMessageTs: '1710000000.123456',
    },
  }
}

function buildSink(): ChannelReplySink {
  return {
    postAgentStream: vi.fn(async () => undefined),
    postError: vi.fn(async () => undefined),
    postText: vi.fn(async () => undefined),
    scheduleBackgroundTask: vi.fn(),
    startTyping: vi.fn(async () => undefined),
  }
}

const { runChannelChatTurn } = await import('./dispatch')
