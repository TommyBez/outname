import type { ModelMessage, TextStreamPart, Tool, UIMessage } from 'ai'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentRuntimeSpec } from './runtime-spec'

const mocks = vi.hoisted(() => ({
  buildAgentRuntimeSpec: vi.fn(),
  buildRealtimeAgentRuntime: vi.fn(),
  cleanupRealtimeRun: vi.fn(),
  getAgentById: vi.fn(),
  insertChatMessageIfNew: vi.fn(),
  maybeGenerateConversationTitle: vi.fn(),
  persistNewChatMessages: vi.fn(),
  preflightBudget: vi.fn(),
  recordTokenUsageStep: vi.fn(),
  revalidateTag: vi.fn(),
  startupSystemSandbox: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('next/cache', () => ({
  revalidateTag: mocks.revalidateTag,
}))

vi.mock('@outname/ai/agent-runtime/server/system-sandbox-startup', () => ({
  startupSystemSandbox: mocks.startupSystemSandbox,
}))

vi.mock('@outname/ai/agent-runtime/server/realtime-cleanup', () => ({
  cleanupRealtimeRun: mocks.cleanupRealtimeRun,
}))

vi.mock('@outname/ai/agent-runtime/server/start-agent-run', () => ({
  getAgentById: mocks.getAgentById,
}))

vi.mock('@outname/ai/agent-runtime/server/runtime-spec', () => ({
  buildAgentRuntimeSpec: mocks.buildAgentRuntimeSpec,
}))

vi.mock('@outname/ai/chat/server/chat', () => ({
  insertChatMessageIfNew: mocks.insertChatMessageIfNew,
  persistNewChatMessages: mocks.persistNewChatMessages,
}))

vi.mock('@outname/ai/chat/workflows/steps/generate-conversation-title', () => ({
  maybeGenerateConversationTitle: mocks.maybeGenerateConversationTitle,
}))

vi.mock('../workflows/session/steps/budget', () => ({
  buildGenerationUsageObservations: (event: { generations?: unknown[] }) =>
    event.generations ?? [],
  preflightBudget: mocks.preflightBudget,
  recordTokenUsageStep: mocks.recordTokenUsageStep,
}))

vi.mock('./realtime-agent-runtime', () => ({
  buildRealtimeAgentRuntime: mocks.buildRealtimeAgentRuntime,
}))

describe('tapFullStream', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('accumulates visible text deltas while yielding original chunks once', async () => {
    const chunks = [
      { type: 'text-delta', text: 'hel' },
      { type: 'tool-call', toolCallId: 'call_1' },
      { type: 'text-delta', text: 'lo' },
    ] as TextStreamPart<Record<string, Tool>>[]
    const readOrder: string[] = []
    const source = (async function* () {
      for (const chunk of chunks) {
        await Promise.resolve()
        readOrder.push(chunk.type)
        yield chunk
      }
    })()
    const accumulator = { text: '' }

    const { tapFullStream } = await import('./realtime-chat-runner')
    const output: TextStreamPart<Record<string, Tool>>[] = []
    for await (const chunk of tapFullStream(source, accumulator)) {
      output.push(chunk)
    }

    expect(output).toEqual(chunks)
    expect(readOrder).toEqual(['text-delta', 'tool-call', 'text-delta'])
    expect(accumulator.text).toBe('hello')
  })

  it('intercepts error chunks via onError and swallows them from the output', async () => {
    const failure = new Error('provider exploded')
    const chunks = [
      { type: 'text-delta', text: 'partial' },
      { type: 'error', error: failure },
      { type: 'text-delta', text: ' more' },
    ] as TextStreamPart<Record<string, Tool>>[]
    const source = (async function* () {
      for (const chunk of chunks) {
        await Promise.resolve()
        yield chunk
      }
    })()
    const accumulator = { text: '' }
    const seen: unknown[] = []

    const { tapFullStream } = await import('./realtime-chat-runner')
    const output: TextStreamPart<Record<string, Tool>>[] = []
    for await (const chunk of tapFullStream(source, accumulator, (error) => {
      seen.push(error)
    })) {
      output.push(chunk)
    }

    expect(seen).toEqual([failure])
    expect(output.map((chunk) => chunk.type)).toEqual([
      'text-delta',
      'text-delta',
    ])
    expect(accumulator.text).toBe('partial more')
  })

  it('propagates upstream stream errors after preserving accumulated text', async () => {
    const accumulator = { text: '' }
    const source = (async function* () {
      await Promise.resolve()
      yield {
        text: 'partial',
        type: 'text-delta',
      } as TextStreamPart<Record<string, Tool>>
      throw new Error('stream failed')
    })()

    const { tapFullStream } = await import('./realtime-chat-runner')
    await expect(async () => {
      for await (const _chunk of tapFullStream(source, accumulator)) {
        // Drain the stream.
      }
    }).rejects.toThrow('stream failed')
    expect(accumulator.text).toBe('partial')
  })
})

describe('realtime chat runner persistence policy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.cleanupRealtimeRun.mockResolvedValue(undefined)
    mocks.getAgentById.mockResolvedValue({
      id: 'agent_123',
      userId: 'user_123',
    })
    mocks.insertChatMessageIfNew.mockResolvedValue(true)
    mocks.buildAgentRuntimeSpec.mockResolvedValue(runtimeSpec())
    mocks.maybeGenerateConversationTitle.mockResolvedValue(undefined)
    mocks.persistNewChatMessages.mockResolvedValue(undefined)
    mocks.recordTokenUsageStep.mockResolvedValue(undefined)
    mocks.startupSystemSandbox.mockResolvedValue(undefined)
  })

  it('persists normal and length-finished UI assistant messages and schedules title generation', async () => {
    const { handleUiMessageFinish } = await import('./realtime-chat-runner')
    const delivery = buildDelivery()
    const responseMessage = assistantMessage('msg_assistant', 'done')
    const userMessages = [userMessage('msg_user', 'hello')]

    await handleUiMessageFinish({
      agentId: 'agent_123',
      conversationId: 'conv_123',
      delivery,
      finishReason: 'length',
      isAborted: false,
      responseMessage,
      stepLimitInput: {
        custom: null,
        mode: 'medium',
        steps: null,
      },
      uiMessages: userMessages,
    })

    expect(mocks.persistNewChatMessages).toHaveBeenCalledWith({
      conversationId: 'conv_123',
      uiMessages: [responseMessage],
    })
    expect(delivery.tasks).toHaveLength(1)
    await delivery.tasks[0]()
    expect(mocks.maybeGenerateConversationTitle).toHaveBeenCalledWith({
      agentId: 'agent_123',
      conversationId: 'conv_123',
      uiMessages: userMessages,
    })
  })

  it('drops aborted and errored UI assistant partials', async () => {
    const { handleUiMessageFinish } = await import('./realtime-chat-runner')
    const delivery = buildDelivery()
    const baseInput = {
      agentId: 'agent_123',
      conversationId: 'conv_123',
      delivery,
      responseMessage: assistantMessage('msg_assistant', 'partial'),
      stepLimitInput: {
        custom: null,
        mode: 'medium' as const,
        steps: null,
      },
      uiMessages: [userMessage('msg_user', 'hello')],
    }

    await handleUiMessageFinish({
      ...baseInput,
      finishReason: 'stop',
      isAborted: true,
    })
    await handleUiMessageFinish({
      ...baseInput,
      finishReason: 'error',
      isAborted: false,
    })

    expect(mocks.persistNewChatMessages).not.toHaveBeenCalled()
    expect(delivery.tasks).toHaveLength(0)
  })

  it('handles text-only budget refusal without model startup, usage recording, or title generation', async () => {
    mocks.preflightBudget.mockResolvedValue({
      limitUsd: 10,
      period: 'daily',
      scope: { type: 'general' },
      spentUsd: 12,
    })
    const delivery = buildDelivery()

    const { runRealtimeChatTurn } = await import('./realtime-chat-runner')
    await runRealtimeChatTurn({
      abortSignal: new AbortController().signal,
      agentId: 'agent_123',
      assistantMessageId: 'msg_assistant',
      conversationId: 'conv_123',
      delivery,
      messages: [],
      persistMode: 'text-only',
      runId: 'rt_123',
      source: 'slack',
      titleMessages: [userMessage('msg_user', 'hello')],
      userId: 'user_123',
    })

    expect(mocks.persistNewChatMessages).toHaveBeenCalledWith({
      conversationId: 'conv_123',
      uiMessages: [
        {
          id: 'budget_refusal_rt_123',
          parts: [
            {
              text: 'Budget exceeded: general daily limit of $10.00 reached ($12.00 spent).',
              type: 'text',
            },
          ],
          role: 'assistant',
        },
      ],
    })
    expect(delivery.postText).toHaveBeenCalledWith(
      'Budget exceeded: general daily limit of $10.00 reached ($12.00 spent).'
    )
    expect(mocks.startupSystemSandbox).not.toHaveBeenCalled()
    expect(mocks.buildRealtimeAgentRuntime).not.toHaveBeenCalled()
    expect(mocks.recordTokenUsageStep).not.toHaveBeenCalled()
    expect(delivery.tasks).toHaveLength(0)
  })

  it('validates ownership before budget checks and sandbox startup', async () => {
    mocks.getAgentById.mockResolvedValue({
      id: 'agent_123',
      userId: 'user_other',
    })
    const delivery = buildDelivery()

    const { runRealtimeChatTurn } = await import('./realtime-chat-runner')
    await expect(
      runRealtimeChatTurn({
        abortSignal: new AbortController().signal,
        agentId: 'agent_123',
        assistantMessageId: 'msg_assistant',
        conversationId: 'conv_123',
        delivery,
        messages: [],
        persistMode: 'text-only',
        runId: 'rt_123',
        source: 'slack',
        titleMessages: [userMessage('msg_user', 'hello')],
        userId: 'user_123',
      })
    ).rejects.toThrow(
      'runRealtimeChatTurn: agent agent_123 does not belong to user user_123'
    )

    expect(mocks.preflightBudget).not.toHaveBeenCalled()
    expect(mocks.startupSystemSandbox).not.toHaveBeenCalled()
    expect(mocks.buildAgentRuntimeSpec).not.toHaveBeenCalled()
  })

  it('starts the system sandbox before composing the runtime spec', async () => {
    mocks.preflightBudget.mockResolvedValue(null)
    mocks.buildRealtimeAgentRuntime.mockResolvedValue({
      agent: {
        stream: async () => ({
          fullStream: streamFromChunks([{ text: 'hello', type: 'text-delta' }]),
        }),
      },
      meta: {
        model: 'openai/gpt-5.1',
        name: 'Agent',
        stepLimitCustom: null,
        stepLimitMode: 'medium',
        userId: 'user_123',
      },
      tools: {},
    })

    const { runRealtimeChatTurn } = await import('./realtime-chat-runner')
    await runRealtimeChatTurn({
      abortSignal: new AbortController().signal,
      agentId: 'agent_123',
      assistantMessageId: 'msg_assistant',
      conversationId: 'conv_123',
      delivery: buildDelivery(),
      messages: [],
      persistMode: 'text-only',
      runId: 'rt_123',
      source: 'slack',
      titleMessages: [userMessage('msg_user', 'hello')],
      userId: 'user_123',
    })

    const [startupOrder] = mocks.startupSystemSandbox.mock.invocationCallOrder
    const [specOrder] = mocks.buildAgentRuntimeSpec.mock.invocationCallOrder
    expect(startupOrder).toBeLessThan(specOrder)
  })

  it('schedules text-only usage recording and persists accumulated assistant text', async () => {
    mocks.preflightBudget.mockResolvedValue(null)
    mocks.buildAgentRuntimeSpec.mockResolvedValue(runtimeSpec())
    mocks.buildRealtimeAgentRuntime.mockImplementation(
      async (
        _spec: AgentRuntimeSpec,
        options: { onFinish?: (event: unknown) => void }
      ) => {
        await Promise.resolve()
        options.onFinish?.({
          generations: [testGeneration()],
          steps: [],
        })
        return {
          agent: {
            stream: async () => ({
              fullStream: streamFromChunks([
                { text: 'hello', type: 'text-delta' },
              ]),
            }),
          },
          meta: {
            model: 'openai/gpt-5.1',
            name: 'Agent',
            stepLimitCustom: null,
            stepLimitMode: 'medium',
            userId: 'user_123',
          },
          tools: {},
        }
      }
    )
    const delivery = buildDelivery({
      postAgentStream: async (stream) => {
        for await (const _chunk of stream) {
          // Drain the Chat SDK stream.
        }
      },
    })

    const { runRealtimeChatTurn } = await import('./realtime-chat-runner')
    await runRealtimeChatTurn({
      abortSignal: new AbortController().signal,
      agentId: 'agent_123',
      assistantMessageId: 'msg_assistant',
      conversationId: 'conv_123',
      delivery,
      messages: [] satisfies ModelMessage[],
      persistMode: 'text-only',
      runId: 'rt_123',
      source: 'slack',
      titleMessages: [userMessage('msg_user', 'hello')],
      userId: 'user_123',
    })

    expect(mocks.insertChatMessageIfNew).toHaveBeenCalledWith({
      conversationId: 'conv_123',
      id: 'msg_assistant',
      metadata: {
        externalThreadId: null,
        runId: 'rt_123',
        source: 'slack',
      },
      parts: [{ text: 'hello', type: 'text' }],
      role: 'assistant',
    })
    expect(delivery.tasks).toHaveLength(2)
    await delivery.tasks[0]()
    expect(mocks.recordTokenUsageStep).toHaveBeenCalledWith({
      agentId: 'agent_123',
      inferenceProvider: 'vercel-ai-gateway',
      model: 'openai/gpt-5.1',
      rootAgentId: 'agent_123',
      sourceId: 'conv_123',
      sourceType: 'chat',
      generations: [testGeneration()],
      userId: 'user_123',
    })
  })

  it('posts a human-readable notice and hides raw error chunks on the channel', async () => {
    mocks.preflightBudget.mockResolvedValue(null)
    mocks.buildAgentRuntimeSpec.mockResolvedValue(runtimeSpec())
    mocks.buildRealtimeAgentRuntime.mockImplementation(
      async (
        _spec: AgentRuntimeSpec,
        options: { onFinish?: (event: unknown) => void }
      ) => {
        await Promise.resolve()
        options.onFinish?.({ generations: [testGeneration()], steps: [] })
        return {
          agent: {
            stream: async () => ({
              fullStream: streamFromChunks([
                { text: 'partial', type: 'text-delta' },
                { type: 'error', error: new Error('provider exploded') },
              ]),
            }),
          },
          meta: {
            model: 'openai/gpt-5.1',
            name: 'Agent',
            stepLimitCustom: null,
            stepLimitMode: 'medium',
            userId: 'user_123',
          },
          tools: {},
        }
      }
    )
    const forwarded: Array<{ type: string }> = []
    const delivery = buildDelivery({
      postAgentStream: async (stream) => {
        for await (const chunk of stream) {
          forwarded.push(chunk as { type: string })
        }
      },
    })
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    const { runRealtimeChatTurn } = await import('./realtime-chat-runner')
    await runRealtimeChatTurn({
      abortSignal: new AbortController().signal,
      agentId: 'agent_123',
      assistantMessageId: 'msg_assistant',
      conversationId: 'conv_123',
      delivery,
      messages: [] satisfies ModelMessage[],
      persistMode: 'text-only',
      runId: 'rt_123',
      source: 'slack',
      titleMessages: [userMessage('msg_user', 'hello')],
      userId: 'user_123',
    })

    // Raw provider error never reaches the channel stream.
    expect(forwarded.map((chunk) => chunk.type)).toEqual(['text-delta'])
    // A readable notice is posted instead.
    expect(delivery.postText).toHaveBeenCalledWith(
      'Something went wrong while the agent was responding. Please try again in a moment.'
    )
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('contains usage recording failures inside the scheduled task', async () => {
    mocks.preflightBudget.mockResolvedValue(null)
    mocks.buildAgentRuntimeSpec.mockResolvedValue(runtimeSpec())
    mocks.recordTokenUsageStep.mockRejectedValue(new Error('usage failed'))
    mocks.buildRealtimeAgentRuntime.mockImplementation(
      async (
        _spec: AgentRuntimeSpec,
        options: { onFinish?: (event: unknown) => void }
      ) => {
        await Promise.resolve()
        options.onFinish?.({
          generations: [testGeneration()],
          steps: [],
        })
        return {
          agent: {
            stream: async () => ({
              fullStream: streamFromChunks([
                { text: 'hello', type: 'text-delta' },
              ]),
            }),
          },
          meta: {
            model: 'openai/gpt-5.1',
            name: 'Agent',
            stepLimitCustom: null,
            stepLimitMode: 'medium',
            userId: 'user_123',
          },
          tools: {},
        }
      }
    )
    const delivery = buildDelivery()
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    try {
      const { runRealtimeChatTurn } = await import('./realtime-chat-runner')
      await runRealtimeChatTurn({
        abortSignal: new AbortController().signal,
        agentId: 'agent_123',
        assistantMessageId: 'msg_assistant',
        conversationId: 'conv_123',
        delivery,
        messages: [] satisfies ModelMessage[],
        persistMode: 'text-only',
        runId: 'rt_123',
        source: 'slack',
        titleMessages: [userMessage('msg_user', 'hello')],
        userId: 'user_123',
      })

      await expect(delivery.tasks[0]()).resolves.toBeUndefined()
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[realtime-chat] usage recording failed',
        expect.objectContaining({
          agentId: 'agent_123',
          conversationId: 'conv_123',
        })
      )
    } finally {
      consoleErrorSpy.mockRestore()
    }
  })

  it('does not persist partial text when channel stream posting fails', async () => {
    mocks.preflightBudget.mockResolvedValue(null)
    mocks.buildAgentRuntimeSpec.mockResolvedValue(runtimeSpec())
    mocks.buildRealtimeAgentRuntime.mockResolvedValue({
      agent: {
        stream: async () => ({
          fullStream: streamFromChunks([
            { text: 'partial', type: 'text-delta' },
          ]),
        }),
      },
      meta: {
        model: 'openai/gpt-5.1',
        name: 'Agent',
        stepLimitCustom: null,
        stepLimitMode: 'medium',
        userId: 'user_123',
      },
      tools: {},
    })
    const delivery = buildDelivery({
      postAgentStream: async (stream) => {
        for await (const _chunk of stream) {
          throw new Error('post failed')
        }
      },
    })

    const { runRealtimeChatTurn } = await import('./realtime-chat-runner')
    await expect(
      runRealtimeChatTurn({
        abortSignal: new AbortController().signal,
        agentId: 'agent_123',
        assistantMessageId: 'msg_assistant',
        conversationId: 'conv_123',
        delivery,
        messages: [],
        persistMode: 'text-only',
        runId: 'rt_123',
        source: 'slack',
        titleMessages: [userMessage('msg_user', 'hello')],
        userId: 'user_123',
      })
    ).rejects.toThrow('post failed')

    expect(mocks.insertChatMessageIfNew).not.toHaveBeenCalled()
    expect(mocks.cleanupRealtimeRun).toHaveBeenCalledWith({
      agentId: 'agent_123',
    })
  })
})

function buildDelivery(overrides: Partial<TestDelivery> = {}): TestDelivery {
  const tasks: Array<() => Promise<void>> = []
  return {
    postAgentStream: vi.fn(async (stream) => {
      for await (const _chunk of stream) {
        // Drain the Chat SDK stream.
      }
    }),
    postText: vi.fn(async () => undefined),
    scheduleBackgroundTask: vi.fn((task) => {
      tasks.push(task)
    }),
    tasks,
    ...overrides,
  }
}

interface TestDelivery {
  postAgentStream: (stream: AsyncIterable<unknown>) => Promise<void>
  postText: (text: string) => Promise<void>
  scheduleBackgroundTask: (task: () => Promise<void>) => void
  tasks: Array<() => Promise<void>>
}

function userMessage(id: string, text: string): UIMessage {
  return {
    id,
    parts: [{ text, type: 'text' }],
    role: 'user',
  }
}

function assistantMessage(id: string, text: string): UIMessage {
  return {
    id,
    parts: [{ text, type: 'text' }],
    role: 'assistant',
  }
}

function runtimeSpec(): AgentRuntimeSpec {
  return {
    agentId: 'agent_123',
    agentName: 'Agent',
    callStack: [],
    depth: 0,
    eventKind: 'chat',
    inferenceProvider: 'vercel-ai-gateway',
    modelId: 'openai/gpt-5.1',
    stepLimitCustom: null,
    stepLimitMode: 'medium',
    systemPrompt: 'You are Agent.',
    skillPlan: { sandboxName: null, skills: [] },
    toolPlan: { planned: [], reconnects: [], subAgents: [] },
    userId: 'user_123',
  }
}

function testGeneration() {
  return {
    generationId: 'gen_123',
    modelId: 'openai/gpt-5.1',
    rawUsage: { cost: 0.000_01 },
    responseMetadata: {
      id: 'gen_123',
      modelId: 'openai/gpt-5.1',
    },
    usage: {
      inputTokens: 3,
      outputTokens: 4,
      totalTokens: 7,
    },
  }
}

async function* streamFromChunks(
  chunks: Array<
    { text: string; type: 'text-delta' } | { type: 'error'; error: unknown }
  >
): AsyncGenerator<TextStreamPart<Record<string, Tool>>, void, unknown> {
  for (const chunk of chunks) {
    await Promise.resolve()
    yield chunk as TextStreamPart<Record<string, Tool>>
  }
}
