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
    vi.useRealTimers()
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

    mocks.resolveRoutesForIncomingMessage.mockResolvedValue([
      {
        agent: firstAgent,
        installationCreatedAt: new Date('2026-05-01T00:00:00.000Z'),
        installationUserId: firstAgent.userId,
      },
      {
        agent: secondAgent,
        installationCreatedAt: new Date('2026-05-02T00:00:00.000Z'),
        installationUserId: secondAgent.userId,
      },
    ])
    mocks.ensureConversationForThread.mockImplementation(
      async ({ agent }: { agent: Agent }) => ({
        agent,
        conversationId: `conv_${agent.id}`,
        installationCreatedAt: new Date('2026-05-01T00:00:00.000Z'),
        installationUserId: agent.userId,
      })
    )
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

    mocks.resolveRoutesForIncomingMessage.mockResolvedValue([
      {
        agent: firstAgent,
        installationCreatedAt: new Date('2026-05-01T00:00:00.000Z'),
        installationUserId: firstAgent.userId,
      },
      {
        agent: secondAgent,
        installationCreatedAt: new Date('2026-05-02T00:00:00.000Z'),
        installationUserId: secondAgent.userId,
      },
    ])
    mocks.ensureConversationForThread.mockImplementation(
      async ({ agent }: { agent: Agent }) => ({
        agent,
        conversationId: `conv_${agent.id}`,
        installationCreatedAt: new Date('2026-05-01T00:00:00.000Z'),
        installationUserId: agent.userId,
      })
    )
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

  it('persists Chat SDK skipped messages before the current Slack message', async () => {
    const agent = buildAgent({
      id: 'agent_alpha',
      name: 'Alpha',
      userId: 'user_alpha',
    })
    const skipped = [
      buildSlackMessage({ messageTs: '1710000000.100000', text: 'first' }),
      buildSlackMessage({ messageTs: '1710000001.200000', text: 'second' }),
    ]
    const current = buildSlackMessage({
      messageTs: '1710000002.300000',
      skipped,
      text: 'third',
    })

    mocks.resolveRoutesForIncomingMessage.mockResolvedValue([
      {
        agent,
        installationCreatedAt: new Date('2026-05-01T00:00:00.000Z'),
        installationUserId: agent.userId,
      },
    ])
    mocks.ensureConversationForThread.mockResolvedValue({
      agent,
      conversationId: 'conv_alpha',
      installationCreatedAt: new Date('2026-05-01T00:00:00.000Z'),
      installationUserId: agent.userId,
    })
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

  it('uses distinct fallback ids when Slack message metadata is missing', async () => {
    const agent = buildAgent({
      id: 'agent_alpha',
      name: 'Alpha',
      userId: 'user_alpha',
    })
    mocks.resolveRoutesForIncomingMessage.mockResolvedValue([
      {
        agent,
        installationCreatedAt: new Date('2026-05-01T00:00:00.000Z'),
        installationUserId: agent.userId,
      },
    ])
    mocks.ensureConversationForThread.mockResolvedValue({
      agent,
      conversationId: 'conv_alpha',
      installationCreatedAt: new Date('2026-05-01T00:00:00.000Z'),
      installationUserId: agent.userId,
    })
    mocks.insertChatMessageIfNew.mockResolvedValue(true)
    mocks.runRealtimeChatTurn.mockResolvedValue(undefined)

    await runChannelChatTurn({
      message: buildSlackMessage({
        includeThreadMetadata: false,
        messageTs: '1710000000.100000',
        text: 'first',
      }),
      sink: buildSink(),
    })
    await runChannelChatTurn({
      message: buildSlackMessage({
        includeThreadMetadata: false,
        messageTs: '1710000001.200000',
        text: 'second',
      }),
      sink: buildSink(),
    })

    const calls = mocks.insertChatMessageIfNew.mock.calls.map(
      ([input]) => input
    )
    expect(calls.map((call) => call.id)).toHaveLength(2)
    expect(new Set(calls.map((call) => call.id)).size).toBe(2)
    expect(calls.map((call) => call.createdAt)).toEqual([undefined, undefined])
  })

  it('falls back to now for malformed Slack timestamps', () => {
    const now = new Date('2026-05-21T10:11:12.000Z')
    vi.useFakeTimers()
    vi.setSystemTime(now)

    expect(parseSlackTs('').toISOString()).toBe(now.toISOString())
    expect(parseSlackTs('not-a-ts').toISOString()).toBe(now.toISOString())
    expect(parseSlackTs('1710000000.not-micros').toISOString()).toBe(
      now.toISOString()
    )
  })
})

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
    includeThreadMetadata?: boolean
    messageTs?: string
    skipped?: IncomingChannelMessage[]
    text?: string
  } = {}
): IncomingChannelMessage {
  const messageTs = input.messageTs ?? '1710000000.123456'
  return {
    channel: 'slack',
    externalRoutingKey: 'C123',
    externalRoutingKind: 'channel',
    externalThreadKey: `C123:${messageTs}`,
    externalUserDisplayName: 'Slack User',
    externalUserId: 'U123',
    loadModelMessages: async (): Promise<ModelMessage[]> => [],
    skipped: input.skipped,
    teamId: 'T123',
    text: input.text ?? 'hello',
    threadMetadata:
      input.includeThreadMetadata === false
        ? undefined
        : {
            slackChannel: 'C123',
            slackMessageTs: messageTs,
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

const { parseSlackTs, runChannelChatTurn } = await import('./dispatch')
